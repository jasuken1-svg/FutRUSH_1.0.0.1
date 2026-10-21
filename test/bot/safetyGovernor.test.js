import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SafetyGovernor } from '../../src/bot/safetyGovernor.js';
import { state } from '../../src/core/state.js';

describe('SafetyGovernor', () => {
  let mockStorageData = {};
  const mockStorage = () => ({
    getItem: (key) => mockStorageData[key] ?? null,
    setItem: (key, val) => { mockStorageData[key] = String(val); },
    removeItem: (key) => { delete mockStorageData[key]; }
  });

  beforeEach(() => {
    mockStorageData = {};
    state.botRunning = false;
    state.botToken = 1;
    state.botLogs = [];
    state.botStatus = '';
    state.snipeSettings = {
      repeat: 0,
      waitSeconds: [15, 35],
      autoSell: false,
      maxPlayers: 5,
      speed: 0,
      maxSpendCoins: 50000,
      hourlySearchLimit: 10,
      dailySearchLimit: 50,
      consecutiveErrorLimit: 3
    };
  });

  afterEach(() => {
    mockStorageData = {};
  });

  it('canSearch allows searching when limits are not reached', () => {
    const gov = new SafetyGovernor({ storage: mockStorage });
    expect(gov.canSearch().allowed).toBe(true);
    expect(gov.isHalted()).toBe(false);
  });

  it('enforces hourlySearchLimit and halts bot', () => {
    state.snipeSettings.hourlySearchLimit = 3;
    const gov = new SafetyGovernor({ storage: mockStorage });

    gov.recordSearch();
    gov.recordSearch();
    expect(gov.canSearch().allowed).toBe(true);

    gov.recordSearch(); // 3 searches reached
    const check = gov.canSearch();
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Saatlik arama limiti doldu');
    expect(gov.isHalted()).toBe(true);
    expect(state.botLogs.some((l) => l.type === 'error' && l.message.includes('Saatlik arama limiti'))).toBe(true);
  });

  it('enforces consecutive error limit on 429 and 500 and resets on 200', () => {
    state.snipeSettings.consecutiveErrorLimit = 3;
    const gov = new SafetyGovernor({ storage: mockStorage });

    gov.recordResult(429);
    gov.recordResult(500);
    expect(gov.isHalted()).toBe(false);

    gov.recordResult(200); // Reset
    gov.recordResult(429);
    gov.recordResult(429);
    expect(gov.isHalted()).toBe(false);

    gov.recordResult(429); // 3rd consecutive error
    expect(gov.isHalted()).toBe(true);
    expect(gov.getHaltReason()).toContain('Ardışık 3 EA sunucu hatası (429) alındı');
  });

  it('enforces maxPlayers and maxSpendCoins limits', () => {
    state.snipeSettings.maxPlayers = 2;
    state.snipeSettings.maxSpendCoins = 10000;
    const gov = new SafetyGovernor({ storage: mockStorage });

    expect(gov.canSearch({ currentBought: 1, currentSpent: 5000 }).allowed).toBe(true);

    // Purchase limit
    const checkBought = gov.canSearch({ currentBought: 2, currentSpent: 5000 });
    expect(checkBought.allowed).toBe(false);
    expect(checkBought.reason).toContain('Alım limiti doldu: 2 oyuncu.');

    gov.resume();
    // Spend limit
    const checkSpend = gov.canSearch({ currentBought: 1, currentSpent: 10000 });
    expect(checkSpend.allowed).toBe(false);
    expect(checkSpend.reason).toContain('Harcama limiti doldu');

    gov.resume();
    // Next cost exceeding spend limit
    const checkNext = gov.canSearch({ currentBought: 1, currentSpent: 8000, nextCost: 3000 });
    expect(checkNext.allowed).toBe(false);
    expect(checkNext.reason).toContain('Harcama limiti aşılacak');
  });

  it('resumes only via user action and resets halt state', () => {
    const gov = new SafetyGovernor({ storage: mockStorage });
    gov.halt('Test durdurma');
    expect(gov.isHalted()).toBe(true);
    expect(gov.canSearch().allowed).toBe(false);

    gov.resume();
    expect(gov.isHalted()).toBe(false);
    expect(gov.getHaltReason()).toBeNull();
    expect(gov.canSearch().allowed).toBe(true);
  });

  it('persists search timestamps across reload', () => {
    const gov1 = new SafetyGovernor({ storage: mockStorage });
    gov1.recordSearch();
    gov1.recordSearch();

    // Reinstantiate to simulate reload
    const gov2 = new SafetyGovernor({ storage: mockStorage });
    const stats = gov2.getStats();
    expect(stats.hourlySearches).toBe(2);
    expect(stats.dailySearches).toBe(2);
  });
});
