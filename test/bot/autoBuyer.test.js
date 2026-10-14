import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/core/config.js';
import { state } from '../../src/core/state.js';

vi.mock('../../src/utils/dom.js', () => ({
  pageWindow: { services: {}, setTimeout: (...args) => globalThis.setTimeout(...args) }
}));
vi.mock('../../src/utils/async.js', () => ({ wait: vi.fn(() => Promise.resolve()) }));

const { runAutoBuyer } = await import('../../src/bot/autoBuyer.js');

function target(name, searches) {
  return { name, eaId: 1, searches, buyNow: 1000, rating: 90 };
}

function prepareBot(targets, settings = {}) {
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
    ...extra
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  CONFIG.bot.delayJitter = 0;
});

describe('runAutoBuyer', () => {
  beforeEach(() => prepareBot([]));

  it('waits between every search across attempts and targets, but not after the final search', async () => {
    prepareBot([target('A', 3), target('B', 1)]);
    const idleWait = vi.fn(async () => true);
    await runAutoBuyer(1, deps(idleWait));

    expect(idleWait).toHaveBeenCalledTimes(3);
    expect(idleWait.mock.calls.map((call) => call[2])).toEqual(['search', 'search', 'search']);
    expect(idleWait.mock.calls.map((call) => call[0])).toEqual([4000, 4000, 4000]);
    expect(state.botStats.searches).toBe(4);
  });

  it('applies configured delay jitter around the selected speed delay', async () => {
    prepareBot([target('A', 2)]);
    CONFIG.bot.delayJitter = 0.25;
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const idleWait = vi.fn(async () => true);
    await runAutoBuyer(1, deps(idleWait));

    expect(idleWait).toHaveBeenCalledWith(5000, 1, 'search');
  });

  it('waits between single searches in consecutive targets', async () => {
    prepareBot([target('A', 1), target('B', 1)]);
    const idleWait = vi.fn(async () => true);
    await runAutoBuyer(1, deps(idleWait));

    expect(idleWait).toHaveBeenCalledOnce();
    expect(idleWait.mock.calls[0][2]).toBe('search');
  });

  it('uses the cycle wait when repeat is unlimited', async () => {
    prepareBot([target('A', 1)], { repeat: 0, waitSeconds: 3 });
    const idleWait = vi.fn(async (ms, token, kind) => {
      state.botRunning = false;
      return kind === 'cycle';
    });
    await runAutoBuyer(1, deps(idleWait));

    expect(idleWait).toHaveBeenCalledWith(3000, 1, 'cycle');
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
    const missedLog = state.botLogs.find((entry) => entry.type === 'missed');
    expect(missedLog.id).toBeGreaterThan(0);
    expect(missedLog.message).toContain('kaçırıldı');
    expect(state.botLogs.map((entry) => entry.id)).toEqual([3, 2, 1]);
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
});
