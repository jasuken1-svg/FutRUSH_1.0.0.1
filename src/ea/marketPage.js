// EA Transfer Market'te tek sayfa arama (maxBuy ile), sonucu EA'dan bagimsiz sekle cevirir:
//   { ok, count, listings: [{ tradeId, price, rating, baseId, own }], error? }
// Mevcut ea/market.js'teki searchAutoBuyOffers ile ayni EA cagrilari: onbellek temizligi,
// UTSearchCriteriaDTO, maskedDefId, count 21, observeEaRequest(…, 18000).

import { pageWindow } from '../utils/dom.js';
import { observeEaRequest } from './observe.js';

const auctionOf = (item) => {
  try {
    return (typeof item.getAuctionData === 'function' && item.getAuctionData()) || item._auction || null;
  } catch (e) {
    return item && item._auction ? item._auction : null;
  }
};

export const fetchMarketPage = async (eaId, maxBuy = 0, { timeoutMs = 18000 } = {}) => {
  const service = pageWindow.services && pageWindow.services.Item;
  const Criteria = pageWindow.UTSearchCriteriaDTO;
  if (!service || typeof service.searchTransferMarket !== 'function') {
    return { ok: false, count: 0, listings: [], error: { message: 'EA Transfer Market arama servisi bulunamadı.' } };
  }
  if (typeof Criteria !== 'function') {
    return { ok: false, count: 0, listings: [], error: { message: 'EA arama ölçütleri hazır değil.' } };
  }
  try {
    if (typeof service.clearTransferMarketCache === 'function') service.clearTransferMarketCache();
  } catch (e) {}
  const criteria = new Criteria();
  criteria.type = 'player';
  criteria.maskedDefId = Number(eaId) & 0xffffff;
  if (Number(maxBuy) > 0) criteria.maxBuy = Number(maxBuy);
  criteria.offset = 0;
  criteria.count = 21;
  const response = await observeEaRequest(service.searchTransferMarket(criteria, 1), timeoutMs);
  if (!response || !response.success) {
    const detail = (response && response.error && (response.error.message || response.error)) || (response && response.timeout ? 'zaman aşımı' : 'EA isteği başarısız');
    return { ok: false, count: 0, listings: [], error: { message: String(detail), timeout: !!(response && response.timeout) } };
  }
  const items = Array.from((response.data && response.data.items) || []);
  const listings = items
    .map((item) => {
      const auction = auctionOf(item);
      return {
        tradeId: Number(auction && auction.tradeId) || 0,
        price: Number(auction && auction.buyNowPrice) || 0,
        rating: Number(item && item.rating) || 0,
        baseId: (Number(item && item.definitionId) || 0) & 0xffffff,
        own: !!(auction && auction.tradeOwner)
      };
    })
    .filter((listing) => listing.price > 0);
  return { ok: true, count: items.length, listings };
};
