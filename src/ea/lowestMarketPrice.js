// Tek kart icin EA Transfer Market en dusuk Hemen Al fiyati.
// 9 adimli tavan dusurme: ilk aramada maxBuy atanmaz; sonraki adimlarda gorulen
// en dusuk fiyattan kademe indirilip PRICE_TIERS ile yuvarlanir.
// Botun findLowestBin / getMarketPrice akisina dokunmaz.
// Sonuc: { price, count } (geriye donuk uyumlu) + topPrices: kucukten buyuge en
// dusuk 1./2./3. fiyat kademeleri (tradeId ile tekillesmis, adet max x21).

import { observeEaRequest } from './observe.js';
import { safetyGovernor } from '../bot/safetyGovernor.js';
import { pageWindow } from '../utils/dom.js';
import { buyNowStep, getJsPriceTiers, roundPriceToTier } from '../utils/format.js';
import { randomBetween, sleep } from '../utils/cancelToken.js';
import { getNextLowerPrice } from './priceSteps.js';
import { SPECIAL_OR_HIGH_MIN_BIDS, STANDARD_LOW_MIN_BIDS } from './market.js';

export const LOWEST_MARKET_STEPS = 9;
// EA bir sayfada en fazla 21 kart dondurur.
export const DEFAULT_MARKET_PAGE_SIZE = 21;
// Ayni fiyat kademesinde sayilabilecek maksimum ilan adi (x21 siniri).
export const MAX_TOP_PRICE_COUNT = DEFAULT_MARKET_PAGE_SIZE;
const MAX_TIER_PRICE = 15000000;
// Cache-busting havuzlari (ea/market.js ile ayni kaynak): her adimda minBid degistirerek
// EA'nin aynı maxBuy sorgusuna onbellekten taze yanit vermesi engellenir.
const CHEAP_CACHE_BUST_MAX_BID = 600;

export const auctionOf = (item) => {
  try {
    return (typeof item.getAuctionData === 'function' && item.getAuctionData()) || item._auction || null;
  } catch (e) {
    return item && item._auction ? item._auction : null;
  }
};

export function getItemDefId(item) {
  if (!item) return 0;
  return Number(
    item.definitionId ||
    item._auction?.item?.definitionId ||
    item.auctionItem?.item?.definitionId ||
    item.data?.definitionId ||
    item._data?.definitionId ||
    item.item?.definitionId ||
    0
  );
}

export function getBuyNow(item) {
  if (!item) return 0;
  const a = auctionOf(item);
  const v = a?.buyNowPrice ?? item?.buyNowPrice ?? item?._auction?.buyNowPrice;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

export const getBandDrop = buyNowStep;
export const roundToTier = (price, tiers) => roundPriceToTier(price, tiers);

export function resolveItemSearchType(itemEntity) {
  if (!itemEntity) return 'player';
  if (typeof itemEntity.getSearchType === 'function') {
    try {
      const type = itemEntity.getSearchType();
      if (type) return type;
    } catch (e) {}
  }
  if (typeof itemEntity.type === 'string' && itemEntity.type) return itemEntity.type;
  if (typeof itemEntity.isPlayer === 'function') {
    try {
      if (itemEntity.isPlayer()) return 'player';
    } catch (e) {}
  }
  return 'player';
}

export function resolveItemCategory(itemEntity) {
  if (itemEntity && typeof itemEntity.category === 'string' && itemEntity.category) return itemEntity.category;
  return 'any';
}

export function nextMaxBuyFromLowest(lowestPrice, priceTiers) {
  const lowest = Number(lowestPrice) || 0;
  const reduced = lowest - buyNowStep(lowest);
  let next = roundPriceToTier(reduced, priceTiers);
  if (next >= lowest) {
    next = roundPriceToTier(lowest - 1, priceTiers);
    if (next >= lowest) next = lowest - 50;
  }
  return Math.max(0, Math.min(MAX_TIER_PRICE, next));
}

// Cache-busting: her adimda minBidi havuz icinde degistirerek EA onbelleginin ayni
// maxBuy sorgusuna bayat veri dondurmesi engellenir (ea/market.js ile ayni mantik).
// maxBuy altindaki minBidler elenir; havuz bosalirsa 0 (filtresiz) kullanilir.
export function applyCacheBustMinBid(criteria, stepIndex) {
  const maxBuy = Number(criteria.maxBuy) || 0;
  const isSpecial = criteria.level === 'SP' ||
    (Array.isArray(criteria.rarities) && criteria.rarities.length > 0);
  const basePool = (maxBuy >= 1500 || isSpecial) ? SPECIAL_OR_HIGH_MIN_BIDS : STANDARD_LOW_MIN_BIDS;
  const pool = basePool.filter((bid) => bid === 0 || (bid < maxBuy && bid <= CHEAP_CACHE_BUST_MAX_BID));
  const minBid = pool.length ? pool[Math.abs(stepIndex) % pool.length] : 0;
  if (minBid > 0) {
    criteria.minBid = minBid;
  } else {
    delete criteria.minBid;
  }
  return minBid;
}

export function makeLowestMarketCriteria(itemEntity, { maxBuy, createCriteria } = {}) {
  const Criteria = (typeof createCriteria === 'function') ? null : pageWindow.UTSearchCriteriaDTO;
  const criteria = (typeof createCriteria === 'function')
    ? createCriteria()
    : (typeof Criteria === 'function' ? new Criteria() : { count: DEFAULT_MARKET_PAGE_SIZE });

  const defId = getItemDefId(itemEntity);
  criteria.defId = [defId];
  const type = resolveItemSearchType(itemEntity);
  criteria.type = type;
  if (type === 'player' && defId > 0) {
    criteria.maskedDefId = Number(defId) & 0xffffff;
  }
  const category = resolveItemCategory(itemEntity);
  if (category && category !== 'any') {
    criteria.category = category;
  }
  if (maxBuy != null && Number.isFinite(Number(maxBuy))) {
    criteria.maxBuy = Math.max(0, Math.min(MAX_TIER_PRICE, Number(maxBuy)));
  }
  return criteria;
}

function updateBucketedSearchCriteria(criteria) {
  const service = pageWindow.services && pageWindow.services.Item;
  const candidates = [service, service && service._searchViewModel, service && service.searchViewModel];
  for (const candidate of candidates) {
    if (candidate && typeof candidate.updateSearchCriteria === 'function') {
      try { candidate.updateSearchCriteria(criteria); } catch (e) {}
      return;
    }
  }
  try {
    const searchModel = pageWindow.getAppMain?.()?.getRootViewController?.()?.getPresentedViewController?.()?.getCurrentViewController?.()?._viewmodel;
    if (searchModel && typeof searchModel.updateSearchCriteria === 'function') {
      searchModel.updateSearchCriteria(criteria);
    }
  } catch (e) {}
}

function emitSearchPin(criteria) {
  try {
    const pin = pageWindow.services && pageWindow.services.PIN;
    if (!pin || typeof pin.sendData !== 'function') return;
    const eventType = (pageWindow.PINEventType && pageWindow.PINEventType.PAGE_VIEW) || 'page_view';
    pin.sendData(eventType, { type: 'Transfer Market Search', criteria });
  } catch (e) {}
}

function matchingBuyNowItems(items, definitionId) {
  const wanted = Number(definitionId);
  const wantedBase = wanted > 0 ? (wanted & 0xffffff) : 0;
  return (Array.isArray(items) ? items : []).filter((item) => {
    const itDefId = getItemDefId(item);
    if (itDefId > 0 && wanted > 0) {
      const itBase = itDefId & 0xffffff;
      if (itDefId !== wanted && itBase !== wantedBase) return false;
    }
    const price = getBuyNow(item);
    return price > 0;
  });
}

function sliceFromItems(items, definitionId) {
  const matched = matchingBuyNowItems(items, definitionId);
  let lowestPrice = 0;
  for (const item of matched) {
    const price = getBuyNow(item);
    if (price > 0 && (lowestPrice === 0 || price < lowestPrice)) lowestPrice = price;
  }
  if (!lowestPrice) return null;
  const count = matched.filter((item) => getBuyNow(item) === lowestPrice).length;
  return { price: lowestPrice, count };
}

// Kart benzersiz ID'si: tradeId (farkli adimlarda ayni kartin tekrar sayilmasini
// onlemek icin tekillestirme anahtari). Alinamazsa null doner.
export function getItemUniqueKey(item) {
  if (!item) return null;
  try {
    const direct = Number(item.tradeId);
    if (Number.isFinite(direct) && direct > 0) return String(direct);
  } catch (e) {}
  try {
    const tid = Number(auctionOf(item)?.tradeId);
    if (Number.isFinite(tid) && tid > 0) return String(tid);
  } catch (e) {}
  return null;
}

// matchingBuyNowItems ile eslesen kartlari buyNowPrice degerine gore gruplar.
// Her kademe icin: benzersiz tradeId'li kartlarin kumesi + ID alinamayan kartlarin
// adi sayisi (fallback). Sonuc: Map<price, { ids:Set<string>, unknown:number }>.
export function groupMatchedByPrice(items, definitionId) {
  const buckets = new Map();
  for (const item of matchingBuyNowItems(items, definitionId)) {
    const price = getBuyNow(item);
    if (!(price > 0)) continue;
    let bucket = buckets.get(price);
    if (!bucket) {
      bucket = { ids: new Set(), unknown: 0 };
      buckets.set(price, bucket);
    }
    const key = getItemUniqueKey(item);
    if (key != null) bucket.ids.add(key);
    else bucket.unknown += 1;
  }
  return buckets;
}

// Birikimli fiyatlardan en dusuk N kademenin tavanini hesaplar; findLowestMarketPrice
// her adimdan sonra yeni maxBuy'u bunun ALTINA indirir. Boylece bir sonraki sayfada
// daha dusuk ilan kalmadiysa dongu durur ve gecen adimlarda gorulen yuksek kademeler
// topPrices'ta korunur.
export function nextMaxBuyBelowTiers(accumulator, priceTiers, currentMaxBuy) {
  const prices = [...accumulator.keys()].sort((a, b) => a - b);
  const target = Math.min(3, prices.length);
  const cap = prices[target - 1];
  if (!(cap > 0)) return 0;
  const reduced = cap - buyNowStep(cap);
  let next = roundPriceToTier(reduced, priceTiers);
  if (!(next < cap)) next = cap - 50;
  next = Math.max(0, Math.min(MAX_TIER_PRICE, next));
  if (currentMaxBuy != null && next >= currentMaxBuy) next = currentMaxBuy - 50;
  return Math.max(0, next);
}

// topPrices accumulator'u: her fiyat kademesi icin seen (benzersiz tradeId kumesi)
// ve bestUnknown (ID alinamayan kartlar icin tek adimda gorulen EN YUKSEK adet).
export function createTopPriceAccumulator() {
  return new Map(); // price -> { seen:Set<string>, bestUnknown:number }
}

export function recordStepBuckets(accumulator, buckets) {
  for (const [price, bucket] of buckets) {
    let entry = accumulator.get(price);
    if (!entry) {
      entry = { seen: new Set(), bestUnknown: 0 };
      accumulator.set(price, entry);
    }
    for (const id of bucket.ids) entry.seen.add(id);
    // ID yoksa tekrar sayisini onlemek icin tek adimda gorilen en yuksek adedi baz al.
    if (bucket.unknown > entry.bestUnknown) entry.bestUnknown = bucket.unknown;
  }
  return accumulator;
}

// Birikimli kademelerden kucukten buyuge en dusuk N fiyat listesini uretir.
// Adet = benzersiz tradeId sayisi (+ fallback unknown adedi), max x21 kirpilir.
export function buildTopPrices(accumulator, limit = 3) {
  const tiers = [];
  for (const [price, entry] of accumulator) {
    const rawCount = entry.seen.size + entry.bestUnknown;
    const count = Math.min(MAX_TOP_PRICE_COUNT, Math.max(1, rawCount));
    tiers.push({ price, count });
  }
  tiers.sort((a, b) => a.price - b.price);
  return tiers.slice(0, Math.max(0, limit)).map((tier, index) => ({ rank: index + 1, ...tier }));
}

export async function searchLowestMarketPage(criteria, { timeoutMs = 18000, services } = {}) {
  if (safetyGovernor.isCaptchaHalted()) {
    return { ok: false, items: [], error: { message: 'CAPTCHA kilitli' } };
  }
  const service = (services && services.Item) || (pageWindow.services && pageWindow.services.Item);
  if (!service || typeof service.searchTransferMarket !== 'function') {
    return { ok: false, items: [], error: { message: 'EA Transfer Market arama servisi bulunamadı.' } };
  }
  try {
    if (typeof service.clearTransferMarketCache === 'function') service.clearTransferMarketCache();
  } catch (e) {}
  updateBucketedSearchCriteria(criteria);
  emitSearchPin(criteria);
  const response = await observeEaRequest(service.searchTransferMarket(criteria, 1), timeoutMs);
  if (!response || !response.success) {
    const detail = (response && response.error && (response.error.message || response.error))
      || (response && response.timeout ? 'zaman aşımı' : 'EA isteği başarısız');
    return { ok: false, items: [], error: { message: String(detail), timeout: !!(response && response.timeout) } };
  }
  const items = Array.isArray(response.data?.items)
    ? response.data.items
    : (Array.isArray(response.items) ? response.items : (Array.isArray(response.data) ? response.data : []));
  return { ok: true, items };
}

export async function findLowestMarketPrice(itemEntity, options = {}) {
  const definitionId = getItemDefId(itemEntity);
  if (!definitionId) {
    return { ok: false, status: 'ERROR', extinct: false, error: { message: 'Kart kimliği yok' }, reason: 'invalid-input' };
  }

  const {
    maxSteps = LOWEST_MARKET_STEPS,
    searchPage,
    services,
    createCriteria,
    sleepFn,
    sleep: optSleep,
    rnd = Math.random,
    gapMs = [100, 300],
    onStep = null,
    onProgress = null,
    priceTiers = (options.priceTiers || getJsPriceTiers(pageWindow)),
    fullPage = DEFAULT_MARKET_PAGE_SIZE,
    cacheBust = true
  } = options;

  const actualSleep = sleepFn || optSleep || sleep;
  const actualSearchPage = searchPage || ((crit) => searchLowestMarketPage(crit, { services }));

  const slices = [];
  // topPrices accumulator: her adimda sayfadaki TÜM fiyat kademeleri birikir
  // (tradeId ile tekillestirilir). Boylece tavan dusurme yuzunden son adimda
  // elenen 2./3. fiyatlar onceki adimlardan tamamlanabilir.
  const topAccumulator = createTopPriceAccumulator();
  let pageSize = fullPage;
  let sawFullPage = false;
  let assignedMaxBuy = null;
  const criteria = makeLowestMarketCriteria(itemEntity, { createCriteria });

  for (let step = 1; step <= maxSteps; step += 1) {
    if (typeof onStep === 'function') onStep(step, maxSteps, assignedMaxBuy);
    if (typeof onProgress === 'function') onProgress({ step, maxSteps, assignedMaxBuy });

    const page = await actualSearchPage(criteria);
    if (!page || !page.ok) {
      const errorMsg = String((page && page.error && (page.error.message || page.error)) || 'EA araması başarısız');
      const rateLimited = /429|rate.?limit|too many/i.test(errorMsg);
      if (slices.length === 0) {
        return {
          ok: false,
          status: 'ERROR',
          extinct: false,
          error: (page && page.error) || { message: errorMsg },
          reason: rateLimited ? 'rate-limited' : 'service-failed',
          slices,
          topPrices: []
        };
      }
      // Kismi sonuc varsa bulunan en dusuk fiyat yine gecerlidir; sadece arama erken biter.
      break;
    }
    const items = Array.isArray(page.items) ? page.items : [];
    if (!items.length) break;

    if (!sawFullPage) {
      pageSize = Math.max(fullPage, items.length);
      sawFullPage = true;
    }

    const slice = sliceFromItems(items, definitionId);
    if (slice) {
      slices.push({ ...slice, step });
    } else {
      break;
    }

    // Bu sayfadaki tum fiyat kademelerini kaydet (erken cikisa karsi 3 fiyat garantisi).
    // Kayit slice'tan SONRA yapilir: ID alinamayan (tradeId'siz) sahte/eski veri sadece
    // en dusuk kademeyle gorunurce accumulator kirlenmesin; asagidaki slices fallback'i
    // bu durumda devreye girer.
    recordStepBuckets(topAccumulator, groupMatchedByPrice(items, definitionId));

    const isFullPage = items.length >= pageSize;
    if (!isFullPage) break;

    // Tavan dusurme: onceki en dusuk tavanin altina inilmeli. Ayrica birikimli
    // kademelerden 3. fiyat garanti icin hedeflenen kademenin de altina inilir;
    // daha dusuk ilan kalmadiysa dongu durur ve onceki adimlardaki yuksek
    // kademeler topPrices'ta korunmus olur.
    let nextMaxBuy = nextMaxBuyFromLowest(slice.price, priceTiers);
    const tierCap = nextMaxBuyBelowTiers(topAccumulator, priceTiers, assignedMaxBuy);
    if (tierCap > 0 && nextMaxBuy > tierCap) nextMaxBuy = tierCap;
    if (!(nextMaxBuy > 0) || (assignedMaxBuy != null && nextMaxBuy >= assignedMaxBuy)) break;
    criteria.maxBuy = nextMaxBuy;
    assignedMaxBuy = nextMaxBuy;
    // Cache-busting: yeni maxBuy ile birlikte minBid kademelerini de kaydir.
    if (cacheBust) applyCacheBustMinBid(criteria, step);

    if (step < maxSteps) {
      const [minGap, maxGap] = gapMs;
      if (maxGap > 0) await actualSleep(randomBetween(minGap, maxGap, rnd));
    }
  }

  if (slices.length === 0) {
    return { ok: true, status: 'EXTINCT', extinct: true, price: null, count: 0, slices, topPrices: [] };
  }
  slices.sort((a, b) => a.price - b.price);
  const cheapest = slices[0].price;
  const best = slices.filter((slice) => slice.price === cheapest).pop();
  // topPrices: kucukten buyuge en dusuk 1./2./3. kademe. Accumulator bos kalirsa
  // (eski sahte test verileri vb.) slices'tan fallback uretilir.
  let topPrices = buildTopPrices(topAccumulator, 3);
  if (!topPrices.length) {
    const byPrice = new Map();
    for (const slice of slices) {
      const entry = byPrice.get(slice.price);
      if (!entry || slice.count > entry.count) byPrice.set(slice.price, { count: slice.count });
    }
    topPrices = [...byPrice.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(0, 3)
      .map(([price, entry], index) => ({ rank: index + 1, price, count: Math.min(MAX_TOP_PRICE_COUNT, entry.count) }));
  }
  return {
    ok: true,
    status: 'OK',
    extinct: false,
    price: best.price,
    count: best.count,
    slices,
    topPrices,
    lowerTierPrice: getNextLowerPrice(best.price) || null
  };
}
