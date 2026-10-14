// EA'da bir oyuncunun en dusuk "Hemen Al" (BIN) fiyatini bulur.
//
// EA pazar sonuclarini FIYATA gore degil bitis zamanina gore siralar ve arama olcutlerinde
// siralama alani yoktur; yani dolu bir sayfa (20-21 ilan) minimumun nerede oldugunu soylemez.
// Yontem: maxBuy ile ara. Sayfa dolu ise gorulen en ucuz ilanin bir basamak altina in, bos/eksik ise
// o tavana kadar HER ilan gorulmus demektir. "Gorulen en ucuzdan daha ucuz ilan yok" kanitlanirsa
// sonuc kesindir (exact). Her aramada maxBuy farkli oldugu icin EA onbellegine de takilmaz.
//
// Bu dosya EA'dan bagimsizdir: arama `search(maxBuy)` fonksiyonuyla verilir ve su sekli doner:
//   { ok, count, listings: [{ tradeId, price, rating, baseId, own }], error? }
// (count: sayfadaki toplam ilan sayisi; listings: fiyati okunabilen ilanlar.)

import { randomBetween, sleep } from '../utils/cancelToken.js';
import { MIN_BIN, priceAbove, priceBelow, roundDownToStep, roundUpToStep } from './priceSteps.js';

export const DEFAULT_PAGE_SIZE = 20;
const KEPT_PRICES = 10;

const lowestOf = (values) => values.reduce((min, value) => (value > 0 && (min === 0 || value < min) ? value : min), 0);

export const findLowestBin = async (search, options = {}) => {
  const {
    reference = 0,          // baslangic tavani icin tahmini fiyat (ornegin FutBIN fiyati); 0 = tavansiz
    maxSearches = 5,
    match = () => true,     // hangi ilanlar hedef oyuncuya ait
    pageSize = DEFAULT_PAGE_SIZE,
    gapMs = [1200, 1800],   // iki arama arasi rastgele bekleme [min, max]; max <= 0 ise yok
    token = null,
    sleepFn = sleep,
    rnd = Math.random,
    spread = false,         // az ilan goruldu ise ust fiyata bir arama daha (aykiri ilan tespiti icin)
    spreadRatio = 1.6,
    spreadMin = 3
  } = options;

  const limit = Math.max(1, Math.floor(Number(maxSearches)) || 1);
  const seen = new Map();   // ilan -> fiyat (yalniz hedef oyuncu)
  const tried = new Set();
  let cap = reference > 0 ? Math.max(MIN_BIN, roundDownToStep(reference)) : 0;
  let covered = 0;          // sayfasi dolmayan en yuksek tavan: bu fiyata kadar TUM ilanlar gorulmustur
  let searches = 0;
  let cancelled = false;
  let failure = null;

  const best = () => lowestOf(Array.from(seen.values()));
  const isExact = () => {
    const current = best();
    return current > 0 && covered >= priceBelow(current);
  };

  const pause = async () => {
    if (!Array.isArray(gapMs) || !(gapMs[1] > 0)) return true;
    return sleepFn(randomBetween(gapMs[0], gapMs[1], rnd), token);
  };

  const run = async (maxBuy) => {
    if (searches > 0 && !(await pause())) {
      cancelled = true;
      return null;
    }
    if (token && token.cancelled) {
      cancelled = true;
      return null;
    }
    tried.add(maxBuy);
    const result = await search(maxBuy);
    searches += 1;
    if (!result || !result.ok) {
      return { failed: (result && result.error) || { message: 'EA araması başarısız' } };
    }
    const listings = Array.isArray(result.listings) ? result.listings : [];
    const count = Number.isFinite(result.count) ? result.count : listings.length;
    listings.forEach((listing, index) => {
      if (match(listing)) seen.set(listing.tradeId ? String(listing.tradeId) : searches + ':' + index, listing.price);
    });
    return { listings, full: count >= pageSize };
  };

  while (searches < limit && !tried.has(cap)) {
    const page = await run(cap);
    if (!page) break;
    if (page.failed) {
      failure = page.failed;
      break;
    }
    if (!page.full) covered = cap === 0 ? Infinity : Math.max(covered, cap);
    if (isExact()) break;
    const current = best();
    if (!page.full) {
      if (cap === 0) break; // tavansiz aramada sayfa dolmadi: baska ilan yok
      // Tavan altinda hedef ilan yok (ya da hedef daha yukarida): yukari cik.
      cap = current ? priceBelow(current) : searches >= limit - 1 ? 0 : roundDownToStep(Math.max(priceAbove(cap), cap * 1.5));
    } else {
      // Dolu sayfa: sayfadaki en ucuz ilanin altina in (filtreden bagimsiz, ilerleme garantisi).
      const floor = lowestOf(page.listings.map((listing) => listing.price));
      const next = floor ? priceBelow(floor) : 0;
      if (next < MIN_BIN) break;
      cap = next;
    }
  }

  let spreadFailed = false;
  if (!failure && !cancelled && spread && best() && seen.size < spreadMin) {
    const wide = roundUpToStep(best() * spreadRatio);
    if (!tried.has(wide)) {
      const page = await run(wide);
      spreadFailed = !!(page && page.failed);
    }
  }

  const price = best();
  const prices = Array.from(seen.values()).sort((a, b) => a - b).slice(0, KEPT_PRICES);
  const base = {
    price: price || null,
    count: price ? prices.filter((value) => value === price).length : 0,
    prices,
    searches,
    spreadFailed
  };
  if (failure) return { ok: false, error: failure, exact: false, ...base };
  if (cancelled) return { ok: false, cancelled: true, exact: false, ...base };
  const none = !price && covered === Infinity;
  return { ok: true, none, exact: none || isExact(), ...base };
};

// Aykiri ilan ayiklama: en ucuz 1-2 ilan, 3. en ucuz ilanin ratio'sundan (varsayilan %90) daha
// ucuzsa "firsat"tir, piyasa fiyati degildir. Ayni fiyatta birden fazla ilan bir fiyat seviyesidir
// (piyasa), asla aykiri sayilmaz. Karar vermek icin en az minListings ilan gerekir; azsa en dusuk
// fiyat aynen doner. ratio <= 0 ayiklamayi kapatir.
export const robustMarketPrice = ({ price = 0, prices = [] } = {}, { ratio = 0.9, minListings = 3, maxSkip = 2 } = {}) => {
  const sorted = (prices || []).filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return { price: price || null, count: 0, skipped: [] };
  const skipped = [];
  let index = 0;
  if (ratio > 0 && sorted.length >= minListings) {
    const reference = sorted[2];
    while (
      index < maxSkip &&
      index < sorted.length - 1 &&
      sorted[index] < reference * ratio &&
      sorted[index] !== sorted[index + 1]
    ) {
      skipped.push(sorted[index]);
      index += 1;
    }
  }
  const market = sorted[index];
  return { price: market, count: sorted.filter((value) => value === market).length, skipped };
};
