import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { pageWindow, observeEaRequest } = vi.hoisted(() => ({
  pageWindow: { services: {}, JSUtils: {} },
  observeEaRequest: vi.fn()
}));

vi.mock('../../src/utils/dom.js', () => ({ pageWindow }));
vi.mock('../../src/ea/observe.js', () => ({ observeEaRequest }));

import {
  DEFAULT_MARKET_PAGE_SIZE,
  findLowestMarketPrice,
  makeLowestMarketCriteria,
  nextMaxBuyFromLowest,
  searchLowestMarketPage
} from '../../src/ea/lowestMarketPrice.js';
import { DEFAULT_PRICE_TIERS } from '../../src/utils/format.js';

const DEF_ID = 227708;

const itemOf = (definitionId, buyNowPrice) => ({
  definitionId,
  getAuctionData: () => ({ buyNowPrice, tradeId: definitionId + buyNowPrice })
});

const fillPage = (price, count, definitionId = DEF_ID) =>
  Array.from({ length: count }, () => itemOf(definitionId, price));

describe('findLowestMarketPrice', () => {
  beforeEach(() => {
    pageWindow.UTSearchCriteriaDTO = class {
      constructor() {
        this.count = 30;
        this.maxBuy = 0;
      }
    };
    pageWindow.JSUtils = { PRICE_TIERS: DEFAULT_PRICE_TIERS };
    pageWindow.services = { Item: {} };
  });

  afterEach(() => {
    delete pageWindow.UTSearchCriteriaDTO;
  });

  it('ilk aramada maxBuy atamaz ve DTO count degerine dokunmaz', async () => {
    const calls = [];
    const searchPage = async (criteria) => {
      calls.push({ maxBuy: criteria.maxBuy, count: criteria.count, defId: criteria.defId });
      return { ok: true, items: fillPage(900, 3) };
    };
    await findLowestMarketPrice({ definitionId: DEF_ID, type: 'player' }, { searchPage, sleepFn: async () => true });
    expect(calls[0].maxBuy).toBe(0);
    expect(calls[0].count).toBe(30);
    expect(calls[0].defId).toEqual([DEF_ID]);
  });

  it('ilk dilim pahali olsa bile siralanmis en ucuz dilimi dondurur', async () => {
    const searchPage = async (criteria) => {
      if (!criteria.maxBuy) return { ok: true, items: fillPage(380000, DEFAULT_MARKET_PAGE_SIZE) };
      if (criteria.maxBuy >= 370000) return { ok: true, items: fillPage(5500, DEFAULT_MARKET_PAGE_SIZE) };
      return { ok: true, items: fillPage(5500, 4) };
    };
    const result = await findLowestMarketPrice({ definitionId: DEF_ID }, { searchPage, sleepFn: async () => true });
    expect(result.ok).toBe(true);
    expect(result.price).toBe(5500);
    expect(result.count).toBe(4);
    expect(result.slices[0].price).toBe(5500);
  });

  it('20 kartlik gercek sayfa doluyken criteria.count 30 olsa bile erken kirilmaz', async () => {
    let calls = 0;
    const searchPage = async (criteria) => {
      calls += 1;
      if (!criteria.maxBuy) return { ok: true, items: fillPage(5000, 20) };
      return { ok: true, items: fillPage(4900, 3) };
    };
    const result = await findLowestMarketPrice({ definitionId: DEF_ID }, { searchPage, sleepFn: async () => true });
    expect(calls).toBeGreaterThan(1);
    expect(result.price).toBe(4900);
  });

  it('yalnizca aranan definitionId kartlarini sayar', async () => {
    const searchPage = async () => ({
      ok: true,
      items: [
        itemOf(999, 200),
        itemOf(DEF_ID, 900),
        itemOf(DEF_ID, 900),
        itemOf(DEF_ID, 1100)
      ]
    });
    const result = await findLowestMarketPrice({ definitionId: DEF_ID }, { searchPage, sleepFn: async () => true });
    expect(result.price).toBe(900);
    expect(result.count).toBe(2);
  });

  it('bos pazarda EXTINCT anlaminda extinct dondurur', async () => {
    const result = await findLowestMarketPrice({ definitionId: DEF_ID }, {
      searchPage: async () => ({ ok: true, items: [] }),
      sleepFn: async () => true
    });
    expect(result.ok).toBe(true);
    expect(result.extinct).toBe(true);
    expect(result.slices.length).toBe(0);
  });

  it('servis hatasinda ok false dondurur', async () => {
    const result = await findLowestMarketPrice({ definitionId: DEF_ID }, {
      searchPage: async () => ({ ok: false, error: { message: 'EA hatası' } }),
      sleepFn: async () => true
    });
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe('EA hatası');
  });

  it('indirilen tavan PRICE_TIERS artisina yuvarlanir', () => {
    expect(nextMaxBuyFromLowest(5500, DEFAULT_PRICE_TIERS)).toBe(5400);
    expect(nextMaxBuyFromLowest(1000, DEFAULT_PRICE_TIERS)).toBe(950);
    expect(nextMaxBuyFromLowest(10100, DEFAULT_PRICE_TIERS)).toBe(9900);
  });

  it('makeLowestMarketCriteria type ve category atar, kaliteye dokunmaz', () => {
    const criteria = makeLowestMarketCriteria({ definitionId: DEF_ID, type: 'player', category: 'any', quality: 'gold' });
    expect(criteria.defId).toEqual([DEF_ID]);
    expect(criteria.type).toBe('player');
    expect(criteria.category).toBe('any');
    expect(criteria.quality).toBeUndefined();
    expect(criteria.level).toBeUndefined();
    expect(criteria.maskedDefId).toBeUndefined();
  });
});

describe('searchLowestMarketPage', () => {
  beforeEach(() => {
    pageWindow.services = {
      Item: {
        clearTransferMarketCache: vi.fn(),
        updateSearchCriteria: vi.fn(),
        searchTransferMarket: vi.fn(() => ({}))
      },
      PIN: { sendData: vi.fn() }
    };
    pageWindow.PINEventType = { PAGE_VIEW: 'page_view' };
    observeEaRequest.mockReset();
  });

  it('onbellegi temizler, 1. sayfayi arar ve PIN gonderir', async () => {
    observeEaRequest.mockResolvedValue({
      success: true,
      data: { items: [itemOf(DEF_ID, 800)] }
    });
    const criteria = { defId: [DEF_ID], type: 'player' };
    const result = await searchLowestMarketPage(criteria);
    expect(pageWindow.services.Item.clearTransferMarketCache).toHaveBeenCalledOnce();
    expect(pageWindow.services.Item.updateSearchCriteria).toHaveBeenCalledWith(criteria);
    expect(pageWindow.services.Item.searchTransferMarket).toHaveBeenCalledWith(criteria, 1);
    expect(pageWindow.services.PIN.sendData).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
  });
});
