// EA Transfer Market arama olcutlerini kurar, ilan arar ve alim istegi gonderir.
// Bagimliliklar: core/state, ea/observe ve utils/dom.

import { state } from '../core/state.js';
import { pageWindow } from '../utils/dom.js';
import { observeEaRequest } from './observe.js';
import { debug, warnOnce } from '../core/logger.js';

export function makeAutoBuyCriteria(targetOrId, maxBuy) {
  const Criteria = pageWindow.UTSearchCriteriaDTO;
  if (typeof Criteria !== 'function') throw new Error('EA arama ölçütleri hazır değil. Web App’i yenileyip tekrar deneyin.');
  const criteria = new Criteria();
  criteria.type = 'player';
  const rawId = typeof targetOrId === 'object' && targetOrId !== null
    ? (targetOrId.eaId || targetOrId.playerId)
    : targetOrId;
  criteria.maskedDefId = Number(rawId) & 0xffffff;
  criteria.maxBuy = Number(maxBuy);
  criteria.offset = 0;
  criteria.count = 21;

  if (typeof targetOrId === 'object' && targetOrId !== null) {
    const raretype = Number(targetOrId.raretype);
    if (raretype > 0) {
      criteria.level = 'SP';
      criteria.rarities = [raretype];
    } else if (Array.isArray(targetOrId.rarityIds) && targetOrId.rarityIds.length > 0) {
      criteria.level = 'SP';
      criteria.rarities = targetOrId.rarityIds.map(Number);
    }
  }
  return criteria;
}

export async function searchAutoBuyOffers(target, eaId, token) {
  const services = pageWindow.services;
  const service = services && services.Item;
  if (!service || typeof service.searchTransferMarket !== 'function') throw new Error('EA Transfer Market arama servisi bulunamadı.');
  if (typeof service.clearTransferMarketCache === 'function') {
    try { service.clearTransferMarketCache(); } catch (e) {
      debug('[FutRUSH:ea]', 'EA Transfer Market önbelleği temizlenemedi.', String(e?.message || e));
    }
  }
  const maxBuy = Math.max(1, Math.floor(Number(target.buyNow) || 0));
  const criteria = makeAutoBuyCriteria(target || eaId, maxBuy);
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
  const service = pageWindow.services?.Item;
  if (!service || typeof service.bid !== 'function') throw new Error('EA satın alma servisi bulunamadı.');
  const observable = service.bid(offer.item, offer.price);
  return observeEaRequest(observable, 15000);
}
