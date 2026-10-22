import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/core/config.js';
import { state } from '../../src/core/state.js';

vi.mock('../../src/targets/targetOps.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    mergeTargetPlayers: vi.fn(() => 2),
    applyTargetAddDiscount: vi.fn(actual.applyTargetAddDiscount),
    applyTargetAddEaTax: vi.fn(actual.applyTargetAddEaTax),
    resolveTargetEaId: vi.fn(async (player) => Number(player.eaId) || 0)
  };
});

vi.mock('../../src/targets/targetStore.js', () => ({
  saveSavedTargetLists: vi.fn(),
  saveTargets: vi.fn()
}));

vi.mock('../../src/futbin/loader.js', () => ({
  fetchCheapestPlayers: vi.fn()
}));

vi.mock('../../src/ea/marketPage.js', () => ({
  fetchMarketPage: vi.fn()
}));

vi.mock('../../src/core/logger.js', () => ({
  info: vi.fn(),
  warnOnce: vi.fn()
}));

const { mergeTargetPlayers } = await import('../../src/targets/targetOps.js');
const { applyTargetAddDiscount } = await import('../../src/targets/targetOps.js');
const { applyTargetAddEaTax } = await import('../../src/targets/targetOps.js');
const { resolveTargetEaId } = await import('../../src/targets/targetOps.js');
const { fetchCheapestPlayers } = await import('../../src/futbin/loader.js');
const { info, warnOnce } = await import('../../src/core/logger.js');
const { on } = await import('../../src/core/events.js');
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
  CONFIG.targetAdd.eaTaxRate = 0.05;
  CONFIG.targetAdd.discountRate = 0.1;
  vi.clearAllTimers();
  vi.useRealTimers();
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
        if (eaId === 1002) {
          expect(mergeTargetPlayers).toHaveBeenCalledOnce();
          expect(mergeTargetPlayers).toHaveBeenCalledWith([{ ...players[0], price: 1300, buyNow: 1100 }]);
        }
        return successfulPage(eaId);
      },
      sleepFn: noWait
    });

    expect(players.map((item) => item.price)).toEqual([1300, 1300]);
    expect(players.map((item) => item.buyNow)).toEqual([1300, 1300]);
    expect(mergeTargetPlayers).toHaveBeenCalledTimes(2);
    expect(mergeTargetPlayers).toHaveBeenNthCalledWith(1, [{ ...players[0], price: 1300, buyNow: 1100 }]);
    expect(mergeTargetPlayers).toHaveBeenNthCalledWith(2, [{ ...players[1], price: 1300, buyNow: 1100 }]);
    expect(applyTargetAddDiscount).toHaveBeenCalledTimes(2);
    expect(progress).toEqual(['EA fiyatı alınıyor 1/2: Alpha', 'EA fiyatı alınıyor 2/2: Beta']);
    expect(state.targetStatus.message).toBe('2 oyuncu hedef listesine eklendi (fiyatlar EA\'dan).');
    expect(state.targetStatus.source).toBe('ea');
    expect(state.targetStatus.progress).toEqual({ done: 2, total: 2 });
  });

  it('holds each non-final player status for the same EA player gap it awaits', async () => {
    vi.useFakeTimers();
    const players = [player('Alpha'), player('Beta', 6000, 1002), player('Gamma', 7000, 1003)];
    CONFIG.targetAdd.actionGapMs = [1500, 2500];
    const gaps = [1700, 2300];
    let gapIndex = 0;
    const expectedMessages = [
      'Alpha · Buy Now 1.100 hedeflere eklendi.',
      'Beta · Buy Now 1.100 hedeflere eklendi.'
    ];
    const random = vi.fn(() => gaps[gapIndex++]);
    const awaitedGaps = [];
    const wait = vi.fn(async (gap) => {
      const index = awaitedGaps.length;
      expect(state.targetStatus.message).toBe(expectedMessages[index]);
      vi.advanceTimersByTime(gap - 1);
      expect(state.targetStatus.message).toBe(expectedMessages[index]);
      vi.advanceTimersByTime(1);
      expect(state.targetStatus).toBeNull();
      awaitedGaps.push(gap);
      return true;
    });
    const statuses = [];
    const stop = on('targets:status', () => {
      const status = state.targetStatus;
      statuses.push(status ? {
        ...status,
        progress: status.progress ? { ...status.progress } : undefined
      } : null);
    });

    await importCheapestTargets(90, 3, {
      fetchCheapestPlayers: async () => ({ players, fallback: false }),
      fetchMarketPage: async (eaId) => successfulPage(eaId),
      sleepFn: noWait,
      randomBetween: random,
      sleep: wait
    });
    stop();

    expect(random).toHaveBeenCalledTimes(2);
    expect(random).toHaveBeenNthCalledWith(1, 1500, 2500);
    expect(random).toHaveBeenNthCalledWith(2, 1500, 2500);
    expect(awaitedGaps).toEqual(gaps);
    expect(statuses.filter((status) => status?.message.includes('Buy Now')).map((status) => status.message)).toEqual(expectedMessages);
    expect(statuses.filter((status) => status?.message.includes('Buy Now')).map(({ source, progress }) => ({ source, progress }))).toEqual([
      { source: 'ea', progress: { done: 1, total: 3 } },
      { source: 'ea', progress: { done: 2, total: 3 } }
    ]);
    expect(statuses.at(-1).message).toBe('3 oyuncu hedef listesine eklendi (fiyatlar EA\'dan).');
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

  it('does not add the in-flight player after its import is cancelled', async () => {
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
    mergeTargetPlayers.mockClear();
    releasePage(successfulPage(1001));
    await previousImport;

    expect(mergeTargetPlayers).not.toHaveBeenCalled();
    expect(firstPlayers.map((item) => item.price)).toEqual([5000, 6000]);
    expect(state.targetStatus.message).toBe('Bulunan oyuncular zaten hedef listesinde.');
  });

  it('imports FutBIN players sequentially with delays and progress updates when configured', async () => {
    CONFIG.targetAdd.priceSource = 'futbin';
    const players = [player('Alpha'), player('Beta', 6000, 1002)];
    const fetchMarketPage = vi.fn();
    const randomBetween = vi.fn(() => 1500);
    const sleepBetween = vi.fn(async () => true);
    mergeTargetPlayers.mockReturnValue(1);
    const messages = [];
    const stop = on('targets:status', () => messages.push(state.targetStatus?.message));

    await importCheapestTargets(90, 2, {
      fetchCheapestPlayers: async () => ({ players, fallback: false }),
      fetchMarketPage,
      randomBetween,
      sleep: sleepBetween
    });

    expect(mergeTargetPlayers).toHaveBeenCalledTimes(2);
    expect(mergeTargetPlayers).toHaveBeenNthCalledWith(1, [
      { ...players[0], price: 5000, buyNow: 4200 }
    ]);
    expect(mergeTargetPlayers).toHaveBeenNthCalledWith(2, [
      { ...players[1], price: 6000, buyNow: 5100 }
    ]);
    expect(randomBetween).toHaveBeenCalledWith(1000, 2000);
    expect(sleepBetween).toHaveBeenCalledWith(1500, expect.any(Object));
    expect(applyTargetAddDiscount).toHaveBeenCalledTimes(2);
    expect(fetchMarketPage).not.toHaveBeenCalled();
    expect(resolveTargetEaId).not.toHaveBeenCalled();
    expect(state.targetStatus.message).toBe('2 oyuncu hedef listesine eklendi.');
    expect(messages).toEqual([
      'FutBIN oyuncuları yükleniyor...',
      'Alpha hedeflere eklendi (1/2)...',
      'Beta hedeflere eklendi (2/2)...',
      '2 oyuncu hedef listesine eklendi.'
    ]);
    stop();
  });

  it('respects a custom discountRate for imported players', async () => {
    CONFIG.targetAdd.priceSource = 'futbin';
    CONFIG.targetAdd.discountRate = 0.2;
    const players = [player('Alpha', 5000)];
    mergeTargetPlayers.mockReturnValue(1);

    await importCheapestTargets(90, 1, {
      fetchCheapestPlayers: async () => ({ players, fallback: false }),
      fetchMarketPage: vi.fn()
    });

    expect(mergeTargetPlayers).toHaveBeenCalledWith([
      { ...players[0], price: 5000, buyNow: 3800 }
    ]);
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
