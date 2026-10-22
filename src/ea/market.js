// EA Transfer Market arama olcutlerini kurar, ilan arar ve alim istegi gonderir.
// Bagimliliklar: core/state, ea/observe, ea/priceSteps ve utils/dom.

import { state } from '../core/state.js';
import { pageWindow } from '../utils/dom.js';
import { observeEaRequest } from './observe.js';
import { debug, warnOnce } from '../core/logger.js';
import { MIN_BIN, roundDownToStep } from './priceSteps.js';
import { safetyGovernor } from '../bot/safetyGovernor.js';

export const HIGH_BID_STEPS = [
  14990000, 14991000, 14992000, 14993000, 14994000,
  14995000, 14996000, 14997000, 14998000, 14999000, 15000000
];

export const SPECIAL_OR_HIGH_MIN_BIDS = [
  0, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600
];

export const STANDARD_LOW_MIN_BIDS = [
  0, 150
];

let cacheBustCounter = 0;

export function resetCacheBustCounter() {
  cacheBustCounter = 0;
}

export function makeAutoBuyCriteria(targetOrId, maxBuyOrOptions, maybeOptions) {
  const Criteria = pageWindow.UTSearchCriteriaDTO;
  if (typeof Criteria !== 'function') throw new Error('EA arama ölçütleri hazır değil. Web App’i yenileyip tekrar deneyin.');
  const criteria = new Criteria();
  criteria.type = 'player';

  let rawMaxBuy;
  let options;
  if (typeof maxBuyOrOptions === 'object' && maxBuyOrOptions !== null) {
    options = maxBuyOrOptions;
    rawMaxBuy = options.maxBuy;
  } else {
    rawMaxBuy = maxBuyOrOptions;
    options = maybeOptions || {};
  }

  const rawId = typeof targetOrId === 'object' && targetOrId !== null
    ? (targetOrId.eaId || targetOrId.playerId)
    : targetOrId;
  criteria.maskedDefId = Number(rawId) & 0xffffff;

  const target = typeof targetOrId === 'object' && targetOrId !== null ? targetOrId : null;
  const inputBuyNow = Number(rawMaxBuy ?? target?.buyNow) || 0;
  const snappedMaxBuy = roundDownToStep(inputBuyNow);
  const resolvedMaxBuy = snappedMaxBuy < MIN_BIN ? MIN_BIN : snappedMaxBuy;
  criteria.maxBuy = resolvedMaxBuy;

  criteria.offset = 0;
  criteria.count = 21;

  if (target) {
    const raretype = Number(target.raretype);
    if (raretype > 0) {
      criteria.level = 'SP';
      criteria.rarities = [raretype];
    } else if (Array.isArray(target.rarityIds) && target.rarityIds.length > 0) {
      criteria.level = 'SP';
      criteria.rarities = target.rarityIds.map(Number);
    }
  }

  if (!options.disableCacheBust) {
    let bustIndex;
    if (typeof options.cacheBustStep === 'number' && Number.isFinite(options.cacheBustStep)) {
      bustIndex = Math.abs(Math.floor(options.cacheBustStep));
    } else if (typeof options.searchIndex === 'number' && Number.isFinite(options.searchIndex)) {
      bustIndex = Math.abs(Math.floor(options.searchIndex));
    } else {
      bustIndex = cacheBustCounter++;
    }

    const raretype = Number(target?.raretype) || 0;
    const isSpecial = raretype > 0 || (Array.isArray(target?.rarityIds) && target.rarityIds.length > 0);
    const minBidBasePool = (resolvedMaxBuy >= 1500 || isSpecial)
      ? SPECIAL_OR_HIGH_MIN_BIDS
      : STANDARD_LOW_MIN_BIDS;

    let minBidPool = minBidBasePool.filter((bid) => bid === 0 || (bid < resolvedMaxBuy && bid <= 600));
    if (!minBidPool.length) minBidPool = [0];

    const minBid = minBidPool[bustIndex % minBidPool.length];
    const maxBid = HIGH_BID_STEPS[Math.floor(bustIndex / minBidPool.length) % HIGH_BID_STEPS.length];

    if (minBid > 0) {
      criteria.minBid = minBid;
    }
    criteria.maxBid = maxBid;
  }

  return criteria;
}

export async function searchAutoBuyOffers(target, eaId, token, options = {}) {
  if (safetyGovernor.isCaptchaHalted()) return { stopped: true, offers: [] };
  const services = pageWindow.services;
  const service = services && services.Item;
  if (!service || typeof service.searchTransferMarket !== 'function') throw new Error('EA Transfer Market arama servisi bulunamadı.');
  if (typeof service.clearTransferMarketCache === 'function') {
    try { service.clearTransferMarketCache(); } catch (e) {
      debug('[FutRUSH:ea]', 'EA Transfer Market önbelleği temizlenemedi.', String(e?.message || e));
    }
  }
  const rawBuyNow = Number(target?.buyNow) || 0;
  const snapped = roundDownToStep(rawBuyNow);
  const maxBuy = snapped < MIN_BIN ? MIN_BIN : snapped;
  const criteria = makeAutoBuyCriteria(target || eaId, maxBuy, options);
  const response = await observeEaRequest(service.searchTransferMarket(criteria, 1), 18000);
  if (token !== state.botToken || !state.botRunning) return { stopped: true, offers: [] };
  if (!response.success) {
    const detail = response.error?.message || response.error || (response.timeout ? 'zaman aşımı' : 'EA isteği başarısız');
    throw new Error('EA pazar araması başarısız: ' + detail);
  }
  const items = Array.from(response.data?.items || []);
  const offers = items.map((item) => {
    let auction = null;
    try { auction = item.getAuctionData?.() || item._auction || null; } catch (e) {
      warnOnce('ea-auction-data-shape', '[FutRUSH:ea]', 'EA ilan auction verisi okunamadı.', 'auction', String(e?.message || e));
    }
    const tradeId = Number(auction?.tradeId) || 0;
    const price = Number(auction?.buyNowPrice) || 0;
    const defId = Number(item?.definitionId) || 0;
    const itemBaseId = defId & 0xffffff;
    const rating = Number(item?.rating) || 0;
    const targetEaId = Number(target?.eaId || eaId) || 0;
    const targetBaseId = targetEaId & 0xffffff;

    if (!auction || !tradeId || auction.tradeOwner || itemBaseId !== targetBaseId || !price || price > maxBuy) return null;
    if (target.rating && rating !== Number(target.rating)) return null;
    if (target.versionKnown && targetEaId > 0xffffff && defId !== targetEaId) return null;
    return { item, auction, price, rating, tradeId };
  }).filter(Boolean).sort((a, b) => a.price - b.price || (Number(b.auction.expires) || 0) - (Number(a.auction.expires) || 0));
  return { stopped: false, offers };
}

export async function buyAutoOffer(offer) {
  if (safetyGovernor.isCaptchaHalted()) {
    return { success: false, blocked: true, error: 'CAPTCHA kilitli' };
  }
  const service = pageWindow.services?.Item;
  if (!service || typeof service.bid !== 'function') throw new Error('EA satın alma servisi bulunamadı.');
  const observable = service.bid(offer.item, offer.price);
  return observeEaRequest(observable, 15000);
}
