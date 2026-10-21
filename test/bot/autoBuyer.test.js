import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/core/config.js';
import { state } from '../../src/core/state.js';
import { safetyGovernor } from '../../src/bot/safetyGovernor.js';

vi.mock('../../src/utils/dom.js', () => ({
  pageWindow: { services: {}, setTimeout: (...args) => globalThis.setTimeout(...args) },
  pageStorage: () => ({ getItem: () => null, setItem: () => {}, removeItem: () => {} })
}));
vi.mock('../../src/utils/async.js', () => ({ wait: vi.fn(() => Promise.resolve()) }));

const { runAutoBuyer } = await import('../../src/bot/autoBuyer.js');

function target(name, searches, eaId = 1) {
  return { name, eaId, searches, buyNow: 1000, rating: 90 };
}

function prepareBot(targets, settings = {}) {
  safetyGovernor.resume();
  safetyGovernor.searches = [];
  state.targets = targets;
  state.snipeSettings = { repeat: 1, waitSeconds: 0, maxPlayers: 10, speed: 1, ...settings };
  state.botRunning = true;
  state.botToken = 1;
  state.botLogs = [];
  state.botLogId = 0;
  state.botStats = { bought: 0, missed: 0, searches: 0, errors: 0 };
}

function deps(idleWait, searchAutoBuyOffers = vi.fn(async () => ({ stopped: false, offers: [] })), extra = {}) {
  return {
    searchAutoBuyOffers,
    buyAutoOffer: vi.fn(),
    idleWait,
    resolveTargetEaId: vi.fn(async () => {}),
    getCoinBalance: vi.fn(() => 10000),
    random: () => 0,
    ...extra
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  CONFIG.bot.searchJitterMs = [350, 600];
  CONFIG.bot.cycleJitterMs = [350, 750];
});

describe('runAutoBuyer', () => {
  beforeEach(() => prepareBot([]));

  it('waits between every search across attempts and targets, but not after the final search', async () => {
    prepareBot([target('A', 3), target('B', 1)]);
    const idleWait = vi.fn(async () => true);
    await runAutoBuyer(1, deps(idleWait));

    expect(idleWait).toHaveBeenCalledTimes(3);
    expect(idleWait.mock.calls.map((call) => call[2])).toEqual(['search', 'search', 'search']);
    expect(idleWait.mock.calls.map((call) => call[0])).toEqual([4350, 4350, 4350]);
    expect(state.botStats.searches).toBe(4);
  });

  it.each([
    [0, 5000],
    [1, 4000],
    [2, 2500],
    [3, 1500]
  ])('adds the configured search jitter at speed %i', async (speed, baseDelay) => {
    prepareBot([target('A', 2)], { speed });
    const idleWait = vi.fn(async () => true);
    await runAutoBuyer(1, deps(idleWait, undefined, { random: () => 0 }));

    expect(idleWait).toHaveBeenCalledWith(baseDelay + 350, 1, 'search');
  });

  it.each([
    [0, 5000],
    [1, 4000],
    [2, 2500],
    [3, 1500]
  ])('uses the search jitter maximum at speed %i', async (speed, baseDelay) => {
    prepareBot([target('A', 2)], { speed });
    const idleWait = vi.fn(async () => true);
    await runAutoBuyer(1, deps(idleWait, undefined, { random: () => 1 }));

    expect(idleWait).toHaveBeenCalledWith(baseDelay + 600, 1, 'search');
  });

  it('waits between single searches in consecutive targets', async () => {
    prepareBot([target('A', 1), target('B', 1)]);
    const idleWait = vi.fn(async () => true);
    await runAutoBuyer(1, deps(idleWait));

    expect(idleWait).toHaveBeenCalledOnce();
    expect(idleWait.mock.calls[0][2]).toBe('search');
  });

  it('logs each resolved player immediately before their first search', async () => {
    prepareBot([target('A', 1, 0), target('B', 1, 0)]);
    const order = [];
    const resolveTargetEaId = vi.fn(async (player) => {
      player.eaId = player.name === 'A' ? 11 : 22;
      order.push(['resolve', player.name]);
    });
    const searchAutoBuyOffers = vi.fn(async (player) => {
      order.push(['search', player.name, state.botLogs[0]?.message]);
      return { stopped: false, offers: [] };
    });

    await runAutoBuyer(1, deps(vi.fn(), searchAutoBuyOffers, { resolveTargetEaId }));

    expect(order.map(([action, name]) => [action, name])).toEqual([
      ['resolve', 'A'],
      ['resolve', 'B'],
      ['search', 'A'],
      ['search', 'B']
    ]);
    expect(order.filter(([action]) => action === 'search').map(([, name, message]) => message)).toEqual([
      'A EA oyuncu kimliğiyle eşleştirildi.',
      'B EA oyuncu kimliğiyle eşleştirildi.'
    ]);
  });

  it('does not repeat the match log when a target already has an EA ID', async () => {
    prepareBot([target('A', 1)]);

    await runAutoBuyer(1, deps(vi.fn()));

    expect(state.botLogs.filter((entry) =>
      entry.message === 'A EA oyuncu kimliğiyle eşleştirildi.'
    )).toHaveLength(0);
  });

  it('uses the cycle wait range when repeat is unlimited', async () => {
    prepareBot([target('A', 1)], { repeat: 0, waitSeconds: [15, 35] });
    const idleWait = vi.fn(async (ms, token, kind) => {
      state.botRunning = false;
      return kind === 'cycle';
    });
    await runAutoBuyer(1, deps(idleWait));

    expect(idleWait).toHaveBeenCalledOnce();
    expect(idleWait).toHaveBeenCalledWith(15350, 1, 'cycle');
  });

  it('supports single number waitSeconds for legacy compatibility', async () => {
    prepareBot([target('A', 1)], { repeat: 0, waitSeconds: 3 });
    const idleWait = vi.fn(async (ms, token, kind) => {
      state.botRunning = false;
      return kind === 'cycle';
    });
    await runAutoBuyer(1, deps(idleWait));

    expect(idleWait).toHaveBeenCalledOnce();
    expect(idleWait).toHaveBeenCalledWith(3350, 1, 'cycle');
  });

  it.each([
    [0, 5000, 0, 350],
    [0, 5000, 1, 750],
    [1, 4000, 0, 350],
    [1, 4000, 1, 750],
    [2, 2500, 0, 350],
    [2, 2500, 1, 750],
    [3, 1500, 0, 350],
    [3, 1500, 1, 750]
  ])('uses the zero-wait cycle base and jitter at speed %i (random %i)', async (speed, baseDelay, randomValue, jitter) => {
    prepareBot([target('A', 1)], { repeat: 0, speed });
    const idleWait = vi.fn(async (ms, token, kind) => {
      state.botRunning = false;
      return kind === 'cycle';
    });
    await runAutoBuyer(1, deps(idleWait, undefined, { random: () => randomValue }));

    expect(idleWait).toHaveBeenCalledOnce();
    expect(idleWait).toHaveBeenCalledWith(baseDelay + jitter, 1, 'cycle');
  });

  it.each([0, 1])('uses one cycle wait of 10 seconds plus jitter (random %i)', async (randomValue) => {
    prepareBot([target('A', 1)], { repeat: 0, waitSeconds: 10 });
    const idleWait = vi.fn(async (ms, token, kind) => {
      state.botRunning = false;
      return kind === 'cycle';
    });
    await runAutoBuyer(1, deps(idleWait, undefined, { random: () => randomValue }));

    expect(idleWait).toHaveBeenCalledOnce();
    expect(idleWait).toHaveBeenCalledWith(randomValue === 0 ? 10350 : 10750, 1, 'cycle');
  });

  it('uses configured jitter ranges for searches and cycles', async () => {
    CONFIG.bot.searchJitterMs = [10, 20];
    CONFIG.bot.cycleJitterMs = [40, 50];
    prepareBot([target('A', 2)], { repeat: 0 });
    const idleWait = vi.fn(async (ms, token, kind) => {
      if (kind === 'cycle') state.botRunning = false;
      return true;
    });
    await runAutoBuyer(1, deps(idleWait, undefined, { random: () => 1 }));

    expect(idleWait.mock.calls.map((call) => [call[0], call[2]])).toEqual([
      [4020, 'search'],
      [4050, 'cycle']
    ]);
  });

  it.each([
    ['reversed range', [600, 350]],
    ['negative range', [-1, 350]],
    ['nonnumeric range', [350, '600']],
    ['non-array range', '350,600']
  ])('falls back to default search and cycle jitter for a %s', async (_label, range) => {
    CONFIG.bot.searchJitterMs = range;
    CONFIG.bot.cycleJitterMs = range;
    prepareBot([target('A', 2)], { repeat: 0 });
    const idleWait = vi.fn(async (ms, token, kind) => {
      if (kind === 'cycle') state.botRunning = false;
      return true;
    });
    await runAutoBuyer(1, deps(idleWait, undefined, {
      random: () => 1
    }));

    expect(idleWait.mock.calls.map((call) => [call[0], call[2]])).toEqual([
      [4600, 'search'],
      [4750, 'cycle']
    ]);
  });

  it('rounds fractional jitter to a whole millisecond', async () => {
    CONFIG.bot.searchJitterMs = [10.2, 10.4];
    prepareBot([target('A', 2)]);
    const idleWait = vi.fn(async () => true);
    await runAutoBuyer(1, deps(idleWait, undefined, { random: () => 0.5 }));

    expect(idleWait).toHaveBeenCalledWith(4010, 1, 'search');
  });

  it('does not wait after reaching the purchase limit', async () => {
    prepareBot([target('A', 3)], { maxPlayers: 1 });
    const idleWait = vi.fn(async () => true);
    const buyAutoOffer = vi.fn(async () => ({ success: true }));
    const searchAutoBuyOffers = vi.fn(async () => ({
      stopped: false,
      offers: [{ tradeId: 7, price: 500, rating: 90 }]
    }));
    await runAutoBuyer(1, deps(idleWait, searchAutoBuyOffers, { buyAutoOffer }));

    expect(idleWait).not.toHaveBeenCalled();
    expect(state.botStats).toMatchObject({ bought: 1, searches: 1 });
    const boughtLog = state.botLogs.find((entry) => entry.kind === 'success');
    expect(boughtLog).toMatchObject({ name: 'A', rating: 90, price: 500, kind: 'success' });
  });

  it('logs and counts missed purchases', async () => {
    prepareBot([target('A', 1)]);
    const searchAutoBuyOffers = vi.fn(async () => ({
      stopped: false,
      offers: [{ tradeId: 9, price: 500, rating: 90 }]
    }));
    await runAutoBuyer(1, deps(vi.fn(), searchAutoBuyOffers, {
      buyAutoOffer: vi.fn(async () => ({ success: false, error: { code: 478 } }))
    }));

    expect(state.botStats).toMatchObject({ missed: 1, errors: 0 });
    const missedLog = state.botLogs.find((entry) => entry.kind === 'missed');
    expect(missedLog.id).toBeGreaterThan(0);
    expect(missedLog).toMatchObject({ name: 'A', rating: 90, price: 500, kind: 'missed' });
    expect(state.botLogs.map((entry) => entry.id)).toEqual([2, 1]);
  });

  it('stops on a fatal purchase error', async () => {
    prepareBot([target('A', 2)]);
    const idleWait = vi.fn();
    const searchAutoBuyOffers = vi.fn(async () => ({
      stopped: false,
      offers: [{ tradeId: 11, price: 500, rating: 90 }]
    }));
    await runAutoBuyer(1, deps(idleWait, searchAutoBuyOffers, {
      buyAutoOffer: vi.fn(async () => ({ success: false, error: { code: 458 } }))
    }));

    expect(state.botRunning).toBe(false);
    expect(idleWait).not.toHaveBeenCalled();
    expect(state.botStats.errors).toBe(1);
  });

  it('stops before purchase when offer exceeds maxSpendCoins limit', async () => {
    prepareBot([target('A', 2)], { maxSpendCoins: 1000 });
    const idleWait = vi.fn();
    const searchAutoBuyOffers = vi.fn(async () => ({
      stopped: false,
      offers: [{ tradeId: 12, price: 1500, rating: 90 }]
    }));
    const buyAutoOffer = vi.fn();

    await runAutoBuyer(1, deps(idleWait, searchAutoBuyOffers, { buyAutoOffer }));

    expect(state.botRunning).toBe(false);
    expect(buyAutoOffer).not.toHaveBeenCalled();
    expect(state.botStatus).toContain('Harcama limiti aşılacak');
  });

  it('stops when cumulative spend reaches maxSpendCoins', async () => {
    prepareBot([target('A', 3)], { maxSpendCoins: 1000, maxPlayers: 5 });
    const idleWait = vi.fn(async () => true);
    let nextTradeId = 13;
    const searchAutoBuyOffers = vi.fn(async () => ({
      stopped: false,
      offers: [{ tradeId: nextTradeId++, price: 500, rating: 90 }]
    }));
    const buyAutoOffer = vi.fn(async () => ({ success: true }));

    await runAutoBuyer(1, deps(idleWait, searchAutoBuyOffers, { buyAutoOffer }));

    expect(state.botRunning).toBe(false);
    expect(state.botStats.bought).toBe(2);
    expect(state.botStatus).toContain('Harcama limiti doldu');
  });

  it('halts when hourly search limit is reached in SafetyGovernor', async () => {
    prepareBot([target('A', 5)], { hourlySearchLimit: 2 });
    const idleWait = vi.fn(async () => true);
    const searchAutoBuyOffers = vi.fn(async () => ({ stopped: false, offers: [] }));

    await runAutoBuyer(1, deps(idleWait, searchAutoBuyOffers));

    expect(state.botRunning).toBe(false);
    expect(safetyGovernor.isHalted()).toBe(true);
    expect(state.botStatus).toContain('Saatlik arama limiti doldu');
  });

  it('halts when consecutive error limit is reached in SafetyGovernor', async () => {
    prepareBot([target('A', 5)], { consecutiveErrorLimit: 2 });
    const idleWait = vi.fn(async () => true);
    let nextTrade = 100;
    const searchAutoBuyOffers = vi.fn(async () => ({
      stopped: false,
      offers: [{ tradeId: nextTrade++, price: 500, rating: 90 }]
    }));
    const buyAutoOffer = vi.fn(async () => ({ success: false, error: { code: 500 } }));

    await runAutoBuyer(1, deps(idleWait, searchAutoBuyOffers, { buyAutoOffer }));

    expect(state.botRunning).toBe(false);
    expect(safetyGovernor.isHalted()).toBe(true);
    expect(state.botStatus).toContain('Ardışık 2 EA sunucu hatası (500) alındı');
  });
});
