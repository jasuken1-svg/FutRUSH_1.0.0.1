// Tek kart icin EA Transfer Market en dusuk Hemen Al fiyati.
// 9 adimli tavan dusurme: ilk aramada maxBuy atanmaz; sonraki adimlarda gorulen
// en dusuk fiyattan kademe indirilip PRICE_TIERS ile yuvarlanir.
// Botun findLowestBin / getMarketPrice akisina dokunmaz.

import { observeEaRequest } from './observe.js';
import { safetyGovernor } from '../bot/safetyGovernor.js';
import { pageWindow } from '../utils/dom.js';
import { buyNowStep, getJsPriceTiers, roundPriceToTier } from '../utils/format.js';
import { randomBetween, sleep } from '../utils/cancelToken.js';

export const LOWEST_MARKET_STEPS = 9;
export const DEFAULT_MARKET_PAGE_SIZE = 20;
const MAX_TIER_PRICE = 15000000;

const auctionOf = (item) => {
  try {
    return (typeof item.getAuctionData === 'function' && item.getAuctionData()) || item._auction || null;
  } catch (e) {
    return item && item._auction ? item._auction : null;
  }
};

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
  return roundPriceToTier(reduced, priceTiers);
}

export function makeLowestMarketCriteria(itemEntity, { maxBuy } = {}) {
  const Criteria = pageWindow.UTSearchCriteriaDTO;
  if (typeof Criteria !== 'function') throw new Error('EA arama ölçütleri hazır değil. Web App’i yenileyip tekrar deneyin.');
  const criteria = new Criteria();
  criteria.defId = [itemEntity.definitionId];
  criteria.type = resolveItemSearchType(itemEntity);
  criteria.category = resolveItemCategory(itemEntity);
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
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (Number(item && item.definitionId) !== wanted) return false;
    const auction = auctionOf(item);
    return Number(auction && auction.buyNowPrice) > 0;
  });
}

function sliceFromItems(items, definitionId) {
  const matched = matchingBuyNowItems(items, definitionId);
  let lowestPrice = 0;
  for (const item of matched) {
    const price = Number(auctionOf(item).buyNowPrice) || 0;
    if (price > 0 && (lowestPrice === 0 || price < lowestPrice)) lowestPrice = price;
  }
  if (!lowestPrice) return null;
  const count = matched.filter((item) => Number(auctionOf(item).buyNowPrice) === lowestPrice).length;
  return { price: lowestPrice, count };
}

export async function searchLowestMarketPage(criteria, { timeoutMs = 18000 } = {}) {
  if (safetyGovernor.isCaptchaHalted()) {
    return { ok: false, items: [], error: { message: 'CAPTCHA kilitli' } };
  }
  const service = pageWindow.services && pageWindow.services.Item;
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
  return { ok: true, items: Array.from((response.data && response.data.items) || []) };
}

export async function findLowestMarketPrice(itemEntity, options = {}) {
  const definitionId = Number(itemEntity && itemEntity.definitionId) || 0;
  if (!definitionId) return { ok: false, extinct: false, error: { message: 'Kart kimliği yok' } };

  const {
    maxSteps = LOWEST_MARKET_STEPS,
    searchPage = searchLowestMarketPage,
    sleepFn = sleep,
    rnd = Math.random,
    gapMs = [100, 300],
    onStep = null,
    priceTiers = getJsPriceTiers(pageWindow)
  } = options;

  const slices = [];
  let pageSize = DEFAULT_MARKET_PAGE_SIZE;
  let sawFullPage = false;
  let assignedMaxBuy = null;
  const criteria = makeLowestMarketCriteria(itemEntity);

  for (let step = 1; step <= maxSteps; step += 1) {
    if (typeof onStep === 'function') onStep(step, maxSteps, assignedMaxBuy);
    const page = await searchPage(criteria);
    if (!page || !page.ok) {
      if (slices.length === 0) return { ok: false, extinct: false, error: (page && page.error) || { message: 'EA araması başarısız' }, slices };
      break;
    }
    const items = Array.isArray(page.items) ? page.items : [];
    if (!items.length) break;

    if (!sawFullPage && items.length >= DEFAULT_MARKET_PAGE_SIZE) {
      pageSize = items.length;
      sawFullPage = true;
    }

    const slice = sliceFromItems(items, definitionId);
    if (slice) slices.push(slice);
    else break;

    const isFullPage = items.length >= pageSize;
    if (!isFullPage) break;

    const nextMaxBuy = nextMaxBuyFromLowest(slice.price, priceTiers);
    if (!(nextMaxBuy > 0) || (assignedMaxBuy != null && nextMaxBuy >= assignedMaxBuy)) break;
    criteria.maxBuy = nextMaxBuy;
    assignedMaxBuy = nextMaxBuy;

    if (step < maxSteps) {
      const [minGap, maxGap] = gapMs;
      if (maxGap > 0) await sleepFn(randomBetween(minGap, maxGap, rnd));
    }
  }

  if (slices.length === 0) return { ok: true, extinct: true, price: null, count: 0, slices };
  slices.sort((a, b) => a.price - b.price);
  const cheapest = slices[0].price;
  const best = slices.filter((slice) => slice.price === cheapest).pop();
  return { ok: true, extinct: false, price: best.price, count: best.count, slices };
}
