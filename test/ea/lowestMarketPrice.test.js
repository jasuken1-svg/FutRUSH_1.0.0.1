import { describe, it, expect } from 'vitest';
import { findLowestMarketPrice, getBandDrop, roundToTier, getBuyNow } from '../../src/ea/lowestMarketPrice.js';

const TIERS = [
  { min: 0, inc: 50 },
  { min: 1000, inc: 100 },
  { min: 10000, inc: 250 },
  { min: 50000, inc: 500 },
  { min: 100000, inc: 1000 },
];

function fakeServices(market, { fail = false } = {}) {
  return {
    Item: {
      clearTransferMarketCache() {},
      searchTransferMarket(criteria) {
        const limit = criteria.maxBuy ?? Infinity;
        const items = fail
          ? null
          : market
              .filter((c) => criteria.defId.includes(c.definitionId) || c.definitionId !== criteria.defId[0])
              .filter((c) => c.buyNowPrice <= limit)
              .slice(0, 20);
        return {
          observe(_o, cb) {
            cb({ unobserve() {} }, fail ? { success: false } : { success: true, data: { items } });
          },
        };
      },
    },
  };
}

const card = (price, definitionId = 111) => ({ definitionId, buyNowPrice: price });
const deps = (market, extra) => ({
  createCriteria: () => ({ count: 30 }),
  priceTiers: TIERS,
  services: fakeServices(market, extra),
  sleep: async () => {},
});

describe('findLowestMarketPrice', () => {
  it('1. adımdaki pahalı dilimi değil, son adımdaki en ucuzu döndürür', async () => {
    const market = [card(380000), ...Array.from({ length: 25 }, () => card(9000)), card(5500), card(5500)];
    const r = await findLowestMarketPrice({ definitionId: 111, type: 'player' }, deps(market));
    expect(r.status).toBe('OK');
    expect(r.price).toBe(5500);
    expect(r.count).toBe(2);
  });

  it('20 kart dönünce count=30 yüzünden 1. adımda kırılmaz', async () => {
    const market = [...Array.from({ length: 25 }, () => card(9000)), card(5500)];
    const r = await findLowestMarketPrice({ definitionId: 111 }, deps(market));
    expect(r.slices.length).toBeGreaterThan(1);
    expect(r.price).toBe(5500);
  });

  it('başka definitionId kartlarını yok sayar', async () => {
    const market = [card(100, 999), card(7000, 111)];
    const r = await findLowestMarketPrice({ definitionId: 111 }, deps(market));
    expect(r.price).toBe(7000);
  });

  it('boş pazar -> EXTINCT, servis hatası -> ERROR', async () => {
    expect((await findLowestMarketPrice({ definitionId: 111 }, deps([]))).status).toBe('EXTINCT');
    expect((await findLowestMarketPrice({ definitionId: 111 }, deps([card(1)], { fail: true }))).status).toBe('ERROR');
  });

  it('fiyat bandı ve tier yuvarlama', () => {
    expect([500, 5000, 20000, 80000, 200000].map(getBandDrop)).toEqual([50, 100, 250, 500, 1000]);
    expect(roundToTier(8930, TIERS)).toBe(8900);
    expect(roundToTier(99_999_999, TIERS)).toBeLessThanOrEqual(15_000_000);
  });

  it('getBuyNow farklı EA nesne hiyerarşilerini doğru çözer', () => {
    expect(getBuyNow({ buyNowPrice: 4500 })).toBe(4500);
    expect(getBuyNow({ _auction: { buyNowPrice: 6200 } })).toBe(6200);
    expect(getBuyNow({ getAuctionData: () => ({ buyNowPrice: 8500 }) })).toBe(8500);
    expect(getBuyNow(null)).toBe(0);
  });
});
