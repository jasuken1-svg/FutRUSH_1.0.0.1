import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/core/config.js';
import { state } from '../../src/core/state.js';

vi.mock('../../src/targets/targetOps.js', () => ({
  mergeTargetPlayers: vi.fn(() => 2),
  resolveTargetEaId: vi.fn(async (player) => Number(player.eaId) || 0)
}));

vi.mock('../../src/futbin/loader.js', () => ({
  fetchCheapestPlayers: vi.fn()
}));

vi.mock('../../src/ea/marketPage.js', () => ({
  fetchMarketPage: vi.fn()
}));

vi.mock('../../src/utils/cancelToken.js', async (importOriginal) => ({
  ...(await importOriginal()),
  actionGap: vi.fn(async () => true)
}));

vi.mock('../../src/core/logger.js', () => ({
  info: vi.fn(),
  warnOnce: vi.fn()
}));

const { mergeTargetPlayers } = await import('../../src/targets/targetOps.js');
const { resolveTargetEaId } = await import('../../src/targets/targetOps.js');
const { fetchCheapestPlayers } = await import('../../src/futbin/loader.js');
const { info, warnOnce } = await import('../../src/core/logger.js');
const { actionGap } = await import('../../src/utils/cancelToken.js');
const { importCheapestTargets } = await import('../../src/targets/futbinImport.js');

afterEach(() => {
  state.targetLoading = false;
  state.targetStatus = null;
  state.botRunning = false;
  state.targets = [];
  CONFIG.targetAdd.priceSource = 'ea';
  CONFIG.targetAdd.maxSearches = 5;
  CONFIG.targetAdd.searchGapMs = [1200, 1800];
  CONFIG.targetAdd.actionGapMs = [1500, 2500];
  CONFIG.targetAdd.outlierRatio = 0.9;
  CONFIG.targetAdd.maxConsecutiveErrors = 2;
  vi.clearAllMocks();
});

describe('importCheapestTargets fallback status', () => {
  it('omits the fallback note when fallback is false', async () => {
    CONFIG.targetAdd.priceSource = 'futbin';
    fetchCheapestPlayers.mockResolvedValue({ players: [], source: 'api', fallback: false });

    await importCheapestTargets(90, 5);

    expect(state.targetStatus).toEqual({
      type: 'success',
      message: '2 oyuncu hedef listesine eklendi.',
      source: 'futbin',
      progress: { done: 0, total: 0 }
    });
    expect(mergeTargetPlayers).toHaveBeenCalledOnce();
  });

  it('adds the fallback note when fallback is true', async () => {
    CONFIG.targetAdd.priceSource = 'futbin';
    fetchCheapestPlayers.mockResolvedValue({ players: [], source: 'html', fallback: true });

    await importCheapestTargets(90, 5);

    expect(state.targetStatus).toEqual({
      type: 'success',
      message: '2 oyuncu hedef listesine eklendi (FutBIN yedek kaynağı).',
      source: 'futbin',
      progress: { done: 0, total: 0 }
    });
  });
});

const player = (name, price = 5000, eaId = 1001) => ({ name, rating: 90, price, eaId, futbinId: name });
const noWait = vi.fn(async () => true);
const successfulPage = (eaId, prices = [1300]) => ({
  ok: true,
  count: prices.length,
  listings: prices.map((price, index) => ({
    tradeId: String(eaId) + ':' + index,
    price,
    rating: 90,
    baseId: eaId,
    own: false
  }))
});

describe('importCheapestTargets EA pricing', () => {
  beforeEach(() => {
    CONFIG.targetAdd.maxSearches = 1;
    CONFIG.targetAdd.searchGapMs = [0, 0];
    CONFIG.targetAdd.actionGapMs = [0, 0];
    CONFIG.targetAdd.outlierRatio = 0;
    mergeTargetPlayers.mockImplementation((players) => players.length);
  });

  it('uses EA prices for all players and reports progress', async () => {
    const players = [player('Alpha'), player('Beta', 6000, 1002)];
    const progress = [];

    await importCheapestTargets(90, 2, {
      fetchCheapestPlayers: async () => ({ players, fallback: false }),
      fetchMarketPage: async (eaId) => {
        progress.push(state.targetStatus.message);
        return successfulPage(eaId);
      },
      sleepFn: noWait
    });

    expect(players.map((item) => item.price)).toEqual([1300, 1300]);
    expect(players.map((item) => item.buyNow)).toEqual([1300, 1300]);
    expect(mergeTargetPlayers.mock.calls.map(([batch]) => batch)).toEqual([[players[0]], [players[1]]]);
    expect(progress).toEqual(['EA fiyatı alınıyor 1/2: Alpha', 'EA fiyatı alınıyor 2/2: Beta']);
    expect(actionGap).toHaveBeenCalledOnce();
    expect(actionGap.mock.calls[0][1]).toEqual([0, 0]);
    expect(state.targetStatus.message).toBe('2 oyuncu hedef listesine eklendi (fiyatlar EA\'dan).');
    expect(state.targetStatus.source).toBe('ea');
    expect(state.targetStatus.progress).toEqual({ done: 2, total: 2 });
  });

  it('uses the FutBIN price for one failed EA search and continues', async () => {
    const players = [player('Alpha'), player('Beta', 6000, 1002)];
    const fetchMarketPage = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { message: 'EA unavailable' } })
      .mockImplementationOnce(async (eaId) => successfulPage(eaId));

    await importCheapestTargets(90, 2, {
      fetchCheapestPlayers: async () => ({ players, fallback: false }),
      fetchMarketPage,
      sleepFn: noWait
    });

    expect(players.map((item) => item.price)).toEqual([5000, 1300]);
    expect(fetchMarketPage).toHaveBeenCalledTimes(2);
    expect(state.targetStatus.message).toBe('2 oyuncu hedef listesine eklendi (1 oyuncuda FutBIN fiyatı kullanıldı).');
    expect(state.targetStatus.source).toBe('mixed');
    expect(state.targetStatus.progress).toEqual({ done: 2, total: 2 });
  });

  it('stops EA searches after the configured consecutive failures', async () => {
    const players = [player('Alpha'), player('Beta', 6000, 1002), player('Gamma', 7000, 1003)];
    const fetchMarketPage = vi.fn().mockResolvedValue({ ok: false, error: { message: 'EA unavailable' } });

    await importCheapestTargets(90, 3, {
      fetchCheapestPlayers: async () => ({ players, fallback: false }),
      fetchMarketPage,
      sleepFn: noWait
    });

    expect(fetchMarketPage).toHaveBeenCalledTimes(2);
    expect(players.map((item) => item.price)).toEqual([5000, 6000, 7000]);
    expect(warnOnce).toHaveBeenCalledOnce();
    expect(state.targetStatus.message).toBe('3 oyuncu hedef listesine eklendi (3 oyuncuda FutBIN fiyatı kullanıldı).');
  });

  it('skips EA searches while the bot is running', async () => {
    state.botRunning = true;
    const players = [player('Alpha')];
    const fetchMarketPage = vi.fn();

    await importCheapestTargets(90, 1, {
      fetchCheapestPlayers: async () => ({ players, fallback: false }),
      fetchMarketPage
    });

    expect(fetchMarketPage).not.toHaveBeenCalled();
    expect(players[0].price).toBe(5000);
    expect(state.targetStatus.message).toBe('1 oyuncu hedef listesine eklendi (1 oyuncuda FutBIN fiyatı kullanıldı).');
  });

  it('cancels an older import, which adds its remaining players at FutBIN prices', async () => {
    let releasePage;
    const firstPlayers = [player('Alpha'), player('Beta', 6000, 1002)];
    const firstPage = new Promise((resolve) => { releasePage = resolve; });
    const firstFetchPage = vi.fn(() => firstPage);

    const previousImport = importCheapestTargets(90, 2, {
      fetchCheapestPlayers: async () => ({ players: firstPlayers, fallback: false }),
      fetchMarketPage: firstFetchPage,
      sleepFn: noWait
    });
    await vi.waitFor(() => expect(firstFetchPage).toHaveBeenCalledOnce());

    await importCheapestTargets(90, 0, {
      fetchCheapestPlayers: async () => ({ players: [], fallback: false })
    });
    releasePage(successfulPage(1001));
    await previousImport;

    expect(firstPlayers.map((item) => item.price)).toEqual([5000, 6000]);
    expect(state.targetStatus.message).toBe('Bulunan oyuncular zaten hedef listesinde.');
  });

  it('preserves the one-batch FutBIN behavior when configured', async () => {
    CONFIG.targetAdd.priceSource = 'futbin';
    const players = [player('Alpha'), player('Beta', 6000, 1002)];
    const fetchMarketPage = vi.fn();
    mergeTargetPlayers.mockReturnValue(2);

    await importCheapestTargets(90, 2, {
      fetchCheapestPlayers: async () => ({ players, fallback: false }),
      fetchMarketPage
    });

    expect(mergeTargetPlayers).toHaveBeenCalledOnce();
    expect(mergeTargetPlayers).toHaveBeenCalledWith(players);
    expect(fetchMarketPage).not.toHaveBeenCalled();
    expect(resolveTargetEaId).not.toHaveBeenCalled();
    expect(state.targetStatus.message).toBe('2 oyuncu hedef listesine eklendi.');
  });

  it('logs outlier listings skipped during EA pricing', async () => {
    const players = [player('Alpha')];
    CONFIG.targetAdd.outlierRatio = 0.9;

    await importCheapestTargets(90, 1, {
      fetchCheapestPlayers: async () => ({ players, fallback: false }),
      fetchMarketPage: async (eaId) => successfulPage(eaId, [500, 1000, 2000]),
      sleepFn: noWait
    });

    expect(info).toHaveBeenCalledWith('EA fiyatı hesaplanırken aykırı ilanlar atlandı:', 'Alpha', [500, 1000]);
    expect(players[0].price).toBe(2000);
  });
});
