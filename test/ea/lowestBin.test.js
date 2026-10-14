import { describe, it, expect } from 'vitest';
import { findLowestBin, robustMarketPrice } from '../../src/ea/lowestBin.js';
import { getMarketPrice } from '../../src/ea/marketPrice.js';
import { createCancelToken } from '../../src/utils/cancelToken.js';

const BASE = 233150;
let nextId = 0;
const listing = (price, extra = {}) => ({ tradeId: ++nextId, price, rating: 82, baseId: BASE, own: false, ...extra });
const noWait = async () => true;
const mine = (l) => !l.own && l.rating === 82 && l.baseId === BASE;

// Sahte pazar: maxBuy filtresi, sonuclar dizi sirasinda (bitis zamani sirasi), sayfa en fazla 21 ilan.
const makeSearch = (market, { failAt = 0 } = {}) => {
  const calls = [];
  const fn = async (maxBuy) => {
    calls.push(maxBuy);
    if (failAt && calls.length === failAt) return { ok: false, error: { message: 'EA hatası' } };
    const page = market.filter((l) => !maxBuy || l.price <= maxBuy).slice(0, 21);
    return { ok: true, count: page.length, listings: page };
  };
  fn.calls = calls;
  return fn;
};

const bigMarket = (n, seedStart = 7) => {
  let seed = seedStart;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  return Array.from({ length: n }, () => listing(600 + Math.floor(rnd() * 40) * 50));
};

describe('findLowestBin', () => {
  it('kucuk pazarda tek aramayla kesin sonuc verir', async () => {
    const market = [listing(900), listing(700), listing(1000), listing(750)];
    const search = makeSearch(market);
    const result = await findLowestBin(search, { reference: 1000, match: mine, sleepFn: noWait });
    expect(result.ok).toBe(true);
    expect(result.price).toBe(700);
    expect(result.exact).toBe(true);
    expect(result.searches).toBe(1);
  });

  it('buyuk pazarda maxBuy dusurerek gercek minimuma ulasir', async () => {
    const market = bigMarket(120);
    const trueMin = Math.min(...market.map((l) => l.price));
    const result = await findLowestBin(makeSearch(market), { reference: 5000, maxSearches: 8, match: mine, sleepFn: noWait });
    expect(result.ok).toBe(true);
    expect(result.exact).toBe(true);
    expect(result.price).toBe(trueMin);
  });

  it('referans cok dusukse yukari cikar', async () => {
    const market = [listing(1500), listing(1800), listing(2000)];
    const result = await findLowestBin(makeSearch(market), { reference: 500, match: mine, sleepFn: noWait });
    expect(result.price).toBe(1500);
    expect(result.exact).toBe(true);
  });

  it('hic ilan yoksa none doner', async () => {
    const result = await findLowestBin(makeSearch([]), { reference: 1000, match: mine, sleepFn: noWait });
    expect(result.ok).toBe(true);
    expect(result.price).toBeNull();
    expect(result.none).toBe(true);
  });

  it('kendi ilani ve baska reyting sayilmaz', async () => {
    const market = [listing(300, { own: true }), listing(350, { rating: 80 }), listing(900)];
    const result = await findLowestBin(makeSearch(market), { reference: 1000, match: mine, sleepFn: noWait });
    expect(result.price).toBe(900);
  });

  it('arama hatasinda ok false ve hata doner', async () => {
    const result = await findLowestBin(makeSearch(bigMarket(50), { failAt: 2 }), { reference: 5000, match: mine, sleepFn: noWait });
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe('EA hatası');
    expect(result.exact).toBe(false);
  });

  it('maxSearches asilmaz', async () => {
    const search = makeSearch(bigMarket(400));
    const result = await findLowestBin(search, { reference: 5000, maxSearches: 2, match: mine, sleepFn: noWait });
    expect(result.searches).toBeLessThanOrEqual(2);
    expect(search.calls.length).toBeLessThanOrEqual(2);
  });

  it('aramalar arasi rastgele bekleme uygulanir (ilk aramadan once yok)', async () => {
    const waits = [];
    const sleepFn = async (ms) => { waits.push(ms); return true; };
    const market = bigMarket(120);
    const result = await findLowestBin(makeSearch(market), { reference: 5000, maxSearches: 8, match: mine, sleepFn, gapMs: [200, 350], rnd: () => 0.5 });
    expect(waits.length).toBe(result.searches - 1);
    waits.forEach((ms) => expect(ms).toBe(275));
  });

  it('bekleme sirasinda iptal edilirse durur', async () => {
    const token = createCancelToken();
    const sleepFn = async () => { token.cancel(); return false; };
    const result = await findLowestBin(makeSearch(bigMarket(120)), { reference: 5000, token, match: mine, sleepFn, gapMs: [200, 350] });
    expect(result.ok).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(result.searches).toBe(1);
  });
});

describe('robustMarketPrice', () => {
  it('tek aykiri ilani atlar', () => {
    const result = robustMarketPrice({ prices: [500, 900, 950, 1000] });
    expect(result.price).toBe(900);
    expect(result.skipped).toEqual([500]);
  });

  it('iki aykiri ilani atlar', () => {
    const result = robustMarketPrice({ prices: [500, 520, 900, 950] });
    expect(result.price).toBe(900);
    expect(result.skipped).toEqual([500, 520]);
  });

  it('ayni fiyatli ilanlar bir fiyat seviyesidir, atlanmaz', () => {
    const result = robustMarketPrice({ prices: [700, 700, 900] });
    expect(result.price).toBe(700);
    expect(result.count).toBe(2);
    expect(result.skipped).toEqual([]);
  });

  it('3\'ten az ilan varsa en dusuk fiyat aynen doner', () => {
    expect(robustMarketPrice({ prices: [700, 1000] }).price).toBe(700);
    expect(robustMarketPrice({ prices: [700] }).price).toBe(700);
  });

  it('ratio 0 ise ayiklama kapali', () => {
    expect(robustMarketPrice({ prices: [500, 900, 950] }, { ratio: 0 }).price).toBe(500);
  });

  it('fiyatlar yakinsa en dusuk secilir', () => {
    expect(robustMarketPrice({ prices: [900, 950, 1000] }).price).toBe(900);
  });
});

describe('getMarketPrice', () => {
  it('aykiri ilani atlayip piyasa fiyatini verir', async () => {
    const market = [listing(500), listing(900), listing(950), listing(1000), listing(1100)];
    const result = await getMarketPrice(makeSearch(market), { eaId: BASE, rating: 82, reference: 1000, sleepFn: noWait, gapMs: [0, 0] });
    expect(result.ok).toBe(true);
    expect(result.lowest).toBe(500);
    expect(result.price).toBe(900);
    expect(result.skipped).toEqual([500]);
  });

  it('outlierRatio 0 ise en dusuk ilan doner', async () => {
    const market = [listing(500), listing(900), listing(950)];
    const result = await getMarketPrice(makeSearch(market), { eaId: BASE, rating: 82, reference: 1000, outlierRatio: 0, sleepFn: noWait, gapMs: [0, 0] });
    expect(result.price).toBe(500);
  });

  it('eaId yuksek bitleri maskelenir ve reyting filtresi uygulanir', async () => {
    const market = [listing(400, { rating: 80 }), listing(900), listing(1000), listing(1100)];
    const result = await getMarketPrice(makeSearch(market), { eaId: BASE + 0x1000000, rating: 82, reference: 1200, outlierRatio: 0, sleepFn: noWait, gapMs: [0, 0] });
    expect(result.price).toBe(900);
  });

  it('arama hatasi ok false doner', async () => {
    const result = await getMarketPrice(makeSearch(bigMarket(50), { failAt: 1 }), { eaId: BASE, rating: 82, reference: 1000, sleepFn: noWait, gapMs: [0, 0] });
    expect(result.ok).toBe(false);
    expect(result.price).toBeNull();
  });
});
