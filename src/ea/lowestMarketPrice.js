// Tek kart için en düşük Hemen Al fiyatını tavan daraltma (iterative ceiling reduction) ile bulur.
// Bağımlılıklar: ea/priceSteps, ea/observe, utils/dom.

import { roundDownToStep, roundToPriceStep, MAX_PRICE as EA_MAX_PRICE, MIN_PRICE as EA_MIN_PRICE, priceBelow } from './priceSteps.js';
import { observeEaRequest } from './observe.js';
import { pageWindow } from '../utils/dom.js';

export const MAX_STEPS = 9;
export const MAX_PRICE = EA_MAX_PRICE || 14999000;
export const DEFAULT_FULL_PAGE = 20;
const SEARCH_TIMEOUT_MS = 15000;

/**
 * lowestPrice üzerinden uygulanacak kademeli indirim miktarı.
 * @param {number} price
 * @returns {number}
 */
export function getBandDrop(price) {
  if (price <= 1000) return 50;
  if (price <= 10000) return 100;
  if (price <= 50000) return 250;
  if (price <= 100000) return 500;
  return 1000;
}

/**
 * Fiyatı oyunun PRICE_TIERS basamağına yuvarlar.
 * @param {number} price
 * @param {Array<{min: number, inc: number}>} [tiers]
 * @returns {number}
 */
export function roundToTier(price, tiers) {
  const p = Math.min(MAX_PRICE, Math.max(0, price));
  if (Array.isArray(tiers) && tiers.length > 0) {
    let inc = tiers[0].inc;
    for (const t of tiers) {
      if (p >= t.min) inc = t.inc;
    }
    if (!inc) return Math.round(p);
    return Math.min(MAX_PRICE, Math.max(0, Math.round(p / inc) * inc));
  }
  return roundToPriceStep(p, 'nearest');
}

/**
 * İlan nesnesinden geçerli buyNowPrice değerini okur.
 * @param {object} item
 * @returns {number}
 */
export function getBuyNow(item) {
  if (!item) return 0;
  const a = (typeof item.getAuctionData === 'function' && item.getAuctionData()) || item?.getAuction?.() || item?._auction || item;
  const v = a?.buyNowPrice;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function getServices() {
  return pageWindow.services;
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randBetween = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

async function searchPage1(services, criteria) {
  try {
    const observable = services.Item.searchTransferMarket(criteria, 1);
    const response = await observeEaRequest(observable, SEARCH_TIMEOUT_MS);
    return response;
  } catch (error) {
    return { success: false, error };
  }
}

export function defaultBeforeSearch(criteria) {
  try {
    const w = pageWindow;
    if (w.services?.PIN && w.PINEventType?.PAGE_VIEW) {
      w.services.PIN.sendData(w.PINEventType.PAGE_VIEW, { type: 'Search - Transfer Market' });
    }
    const searchModel = w.getAppMain?.()?.getRootViewController?.()?.getPresentedViewController?.()?.getCurrentViewController?.()?._viewmodel;
    if (searchModel && typeof searchModel.updateSearchCriteria === 'function') {
      searchModel.updateSearchCriteria(criteria);
    }
  } catch (_) {}
}

/**
 * Tek kart için 9 adımlı en düşük piyasa fiyatı arama döngüsü.
 *
 * @param {object} itemEntity - UTItemEntity (definitionId, type, category)
 * @param {object} [deps]
 * @returns {Promise<{status:'OK'|'EXTINCT'|'ERROR', price?:number, count?:number, slices?:Array, partial?:boolean, reason?:string}>}
 */
export async function findLowestMarketPrice(itemEntity, deps = {}) {
  const {
    createCriteria = () => {
      const Criteria = pageWindow.UTSearchCriteriaDTO;
      return typeof Criteria === 'function' ? new Criteria() : { count: DEFAULT_FULL_PAGE };
    },
    priceTiers,
    roundPrice,
    services = getServices(),
    sleep = defaultSleep,
    signal,
    onProgress,
    beforeSearch = defaultBeforeSearch,
    fullPage = DEFAULT_FULL_PAGE,
    maxSteps = MAX_STEPS,
  } = deps;

  const defId = itemEntity?.definitionId;
  if (!defId || typeof createCriteria !== 'function' || !services?.Item) {
    return { status: 'ERROR', reason: 'invalid-input' };
  }

  const round = roundPrice ?? (priceTiers ? ((n) => roundToTier(n, priceTiers)) : roundDownToStep);
  const minPrice = priceTiers?.[0]?.min ?? EA_MIN_PRICE ?? 200;

  const criteria = createCriteria();
  criteria.defId = [defId];
  criteria.type = (typeof itemEntity.isPlayer === 'function' && itemEntity.isPlayer()) ? 'player' : (itemEntity.type || 'player');
  criteria.category = itemEntity.category || 'any';

  const slices = [];
  let threshold = fullPage;
  let partial = false;

  for (let step = 1; step <= maxSteps; step++) {
    if (signal?.aborted) {
      partial = true;
      break;
    }
    onProgress?.({ step, maxSteps });

    try {
      if (typeof services.Item.clearTransferMarketCache === 'function') {
        services.Item.clearTransferMarketCache();
      }
    } catch (_) {}

    beforeSearch?.(criteria, step);

    const res = await searchPage1(services, criteria);
    if (!res?.success) {
      if (slices.length === 0) return { status: 'ERROR', reason: 'service-failed' };
      partial = true;
      break;
    }

    const items = res.data?.items;
    if (!Array.isArray(items) || items.length === 0) break;

    // Tuzak 2: 1. adımda gelen gerçek kart sayısı ile sayfa eşiği tespiti
    if (step === 1) threshold = Math.max(fullPage, items.length);

    // Tuzak 3: definitionId filtrelemesi
    const prices = items
      .filter((it) => it?.definitionId === defId)
      .map(getBuyNow)
      .filter((p) => p > 0);

    if (prices.length === 0) break;

    const lowest = Math.min(...prices);
    const count = prices.filter((p) => p === lowest).length;
    slices.push({ price: lowest, count, step });

    // Sayfa tam dolmadıysa bu fiyattan daha ucuz ilan yoktur
    if (items.length < threshold) break;

    // Sonraki tavan hesabı
    let next = round(lowest - getBandDrop(lowest));
    if (next >= lowest) {
      const steppedDown = priceBelow(lowest);
      next = steppedDown > 0 ? steppedDown : round(lowest - 1);
    }
    if (next >= lowest) break;
    next = Math.min(MAX_PRICE, Math.max(0, next));
    if (next <= 0 || lowest <= minPrice) break;
    criteria.maxBuy = next;

    if (step < maxSteps) await sleep(randBetween(100, 300));
  }

  // Tuzak 4: Boş pazar kontrolü
  if (slices.length === 0) return { status: 'EXTINCT' };

  // Tuzak 1: En düşük fiyatı garantiye almak için fiyata göre küçükten büyüğe sırala
  slices.sort((a, b) => a.price - b.price);
  const best = slices[0];
  return { status: 'OK', price: best.price, count: best.count, slices, partial };
}
