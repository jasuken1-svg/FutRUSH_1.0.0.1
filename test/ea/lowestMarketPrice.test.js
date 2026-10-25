import { describe, it, expect } from 'vitest';
import {
  findLowestMarketPrice, getBandDrop, roundToTier, getBuyNow,
  groupMatchedByPrice, createTopPriceAccumulator, recordStepBuckets, buildTopPrices
} from '../../src/ea/lowestMarketPrice.js';

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
        // Gercek EA davranisi: minBid ustu ilanlar da doner (asgari teklif filtresi).
        const floor = criteria.minBid ?? 0;
        // Fiyat okumasi getBuyNow ile ayni: düz buyNowPrice VEYA _auction.buyNowPrice.
        const priceOf = (c) => (typeof c.buyNowPrice === 'number' ? c.buyNowPrice : (c._auction?.buyNowPrice ?? 0));
        const items = fail
          ? null
          : market
              .filter((c) => criteria.defId.includes(c.definitionId) || c.definitionId !== criteria.defId[0])
              .filter((c) => priceOf(c) <= limit && priceOf(c) >= floor)
              .slice(0, 21);
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
const tradeCard = (tradeId, price, definitionId = 111) => ({
  definitionId,
  _auction: { tradeId, buyNowPrice: price },
});
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

  it('topPrices küçükten büyüğe en düşük 1./2./3. fiyatı adetlerle döndürür', async () => {
    const market = [
      ...Array.from({ length: 4 }, (_, i) => tradeCard(900 + i, 1200)),
      ...Array.from({ length: 12 }, (_, i) => tradeCard(1900 + i, 1300)),
      ...Array.from({ length: 25 }, (_, i) => tradeCard(2900 + i, 1400)),
    ];
    const r = await findLowestMarketPrice({ definitionId: 111 }, deps(market));
    expect(r.status).toBe('OK');
    expect(r.price).toBe(1200);
    expect(r.count).toBe(4);
    expect(r.topPrices).toEqual([
      { rank: 1, price: 1200, count: 4 },
      { rank: 2, price: 1300, count: 12 },
      { rank: 3, price: 1400, count: 5 }, // sayfa dolmadigi icin kademe TAM goruldu -> kesinti YOK
    ]);
  });

  it('tam dolu sayfada en düsk kademe sayfayi kaplarsa kesilir ve x21 raporlanır', async () => {
    let calls = 0;
    const searchPage = () => {
      calls += 1;
      if (calls === 1) {
        // Sayfa TAM dolu (21): ilk 21 ilan 1200'de kesilmis kademe, ustunde 1300 var.
        return Promise.resolve({
          ok: true,
          items: [
            ...Array.from({ length: 21 }, (_, i) => tradeCard(900 + i, 1200)),
            tradeCard(5000, 1300),
          ],
        });
      }
      // Tavan 1200'un altina iner; tavan kesintisi tek basina x21'i DEGIL,
      // yukaridaki liste kesinti sinyali tetikler.
      return Promise.resolve({ ok: true, items: [] });
    };
    const r = await findLowestMarketPrice({ definitionId: 111 }, {
      createCriteria: () => ({ count: 30 }),
      priceTiers: TIERS,
      searchPage,
      sleep: async () => {},
    });
    expect(r.price).toBe(1200);
    expect(r.topPrices).toEqual([
      { rank: 1, price: 1200, count: 21 }, // liste kesintisi -> x21'e tamamlandi
      { rank: 2, price: 1300, count: 1 },
    ]);
  });

  it('sayfa tam dolu ama son kart fiyatı eksikse kademe kesilmiş sayılmaz', async () => {
    let calls = 0;
    const searchPage = () => {
      calls += 1;
      if (calls === 1) {
        // 21 kart: 12 tanesi 1200, 9 tanesi 1300, son kartta fiyat bilgisi YOK
        // (henuz yuklenmemis kart simulasyonu). Gorulen en dusuk kademe sayfayi
        // kaplamadigi icin kesinti degil -> yanlis pozitif uretilmez.
        return Promise.resolve({
          ok: true,
          items: [
            ...Array.from({ length: 12 }, (_, i) => tradeCard(900 + i, 1200)),
            ...Array.from({ length: 8 }, (_, i) => tradeCard(1900 + i, 1300)),
            { definitionId: 111 },
          ],
        });
      }
      return Promise.resolve({ ok: true, items: [tradeCard(900, 1200)] });
    };
    const r = await findLowestMarketPrice({ definitionId: 111 }, {
      createCriteria: () => ({ count: 30 }),
      priceTiers: TIERS,
      searchPage,
      sleep: async () => {},
    });
    expect(r.price).toBe(1200);
    expect(r.topPrices[0]).toEqual({ rank: 1, price: 1200, count: 12 });
  });

  it('aynı tradeId tekrarları tekilleştirilir (tek arama sayfası)', () => {
    const acc = createTopPriceAccumulator();
    recordStepBuckets(acc, groupMatchedByPrice([tradeCard(1, 1000), tradeCard(1, 1000), tradeCard(2, 1000)], 111));
    expect(buildTopPrices(acc)).toEqual([{ rank: 1, price: 1000, count: 2 }]);
  });

  it('ID alınamayan kartlar için tek adımdaki en yüksek adet baz alınır', () => {
    const acc = createTopPriceAccumulator();
    recordStepBuckets(acc, groupMatchedByPrice([card(1000), card(1000)], 111));
    recordStepBuckets(acc, groupMatchedByPrice([card(1000)], 111));
    expect(buildTopPrices(acc)).toEqual([{ rank: 1, price: 1000, count: 2 }]);
  });

  it('erken çıkışta (sayfa dolmadı) tavan yüzünden elenen 2./3. fiyatlar önceki adımlardan tamamlanır', async () => {
    let calls = 0;
    const searchPage = () => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve({
          ok: true,
          items: [
            tradeCard(1, 1000),
            tradeCard(2, 1200),
            ...Array.from({ length: 19 }, (_, i) => tradeCard(100 + i, 1500)),
          ],
        });
      }
      // maxBuy=950 sonrasi yalnizca en ucuz kademe doner; sayfa dolmaz -> erken kirilma.
      return Promise.resolve({ ok: true, items: [tradeCard(1, 1000)] });
    };
    const r = await findLowestMarketPrice({ definitionId: 111 }, {
      createCriteria: () => ({ count: 30 }),
      priceTiers: TIERS,
      searchPage,
      sleep: async () => {},
    });
    expect(calls).toBe(2);
    expect(r.price).toBe(1000);
    expect(r.topPrices).toEqual([
      { rank: 1, price: 1000, count: 1 },
      { rank: 2, price: 1200, count: 1 },
      { rank: 3, price: 1500, count: 19 },
    ]);
  });

  it('EXTINCT durumunda topPrices bos dizi doner', async () => {
    const r = await findLowestMarketPrice({ definitionId: 111 }, deps([]));
    expect(r.status).toBe('EXTINCT');
    expect(r.topPrices).toEqual([]);
  });
});
