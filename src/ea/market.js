import { state } from '../core/state.js';
import { pageWindow } from '../utils/dom.js';
import { observeEaRequest } from './observe.js';

export function makeAutoBuyCriteria(eaId, maxBuy) {
  const Criteria = pageWindow.UTSearchCriteriaDTO;
  if (typeof Criteria !== 'function') throw new Error('EA arama ölçütleri hazır değil. Web App’i yenileyip tekrar deneyin.');
  const criteria = new Criteria();
  criteria.type = 'player';
  criteria.maskedDefId = Number(eaId) & 0xffffff;
  criteria.maxBuy = Number(maxBuy);
  criteria.offset = 0;
  criteria.count = 21;
  return criteria;
}

export async function searchAutoBuyOffers(target, eaId, token) {
  const services = pageWindow.services;
  const service = services && services.Item;
  if (!service || typeof service.searchTransferMarket !== 'function') throw new Error('EA Transfer Market arama servisi bulunamadı.');
  if (typeof service.clearTransferMarketCache === 'function') {
    try { service.clearTransferMarketCache(); } catch (e) {}
  }
  const maxBuy = Math.max(1, Math.floor(Number(target.buyNow) || 0));
  const criteria = makeAutoBuyCriteria(eaId, maxBuy);
  const response = await observeEaRequest(service.searchTransferMarket(criteria, 1), 18000);
  if (token !== state.botToken || !state.botRunning) return { stopped: true, offers: [] };
  if (!response.success) {
    const detail = response.error?.message || response.error || (response.timeout ? 'zaman aşımı' : 'EA isteği başarısız');
    throw new Error('EA pazar araması başarısız: ' + detail);
  }
  const items = Array.from(response.data?.items || []);
  const offers = items.map((item) => {
    let auction = null;
    try { auction = item.getAuctionData?.() || item._auction || null; } catch (e) {}
    const tradeId = Number(auction?.tradeId) || 0;
    const price = Number(auction?.buyNowPrice) || 0;
    const itemBaseId = (Number(item?.definitionId) || 0) & 0xffffff;
    const rating = Number(item?.rating) || 0;
    if (!auction || !tradeId || auction.tradeOwner || itemBaseId !== Number(eaId) || !price || price > maxBuy || (target.rating && rating !== Number(target.rating))) return null;
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
