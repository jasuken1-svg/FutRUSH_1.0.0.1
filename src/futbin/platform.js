// FutBIN platform ve fiyat okuma yardimcilari:
// getPlatform() secili platformu ('ps' veya 'pc') dondurur.
// getFutbinRowPrice() FutBIN satirindan secili platformun fiyatini okur; eksikse null doner, diger platforma dusmez.

import { getPlatform } from '../core/prefs.js';

export { getPlatform };

export function getFutbinRowPrice(row, platform = getPlatform()) {
  if (!row) return null;
  const plat = platform === 'pc' ? 'pc' : 'ps';
  const field = plat === 'pc' ? 'pc_LCPrice' : 'ps_LCPrice';
  const rawPrice = row[field];
  const price = Number(rawPrice);
  if (Number.isFinite(price) && price > 0) {
    return price;
  }
  return null;
}

export function formatFutbinRowPrice(row, platform = getPlatform()) {
  const price = getFutbinRowPrice(row, platform);
  const platLabel = (platform === 'pc' ? 'PC' : 'PS');
  if (!price) {
    return platLabel + ' fiyat: fiyat yok';
  }
  return platLabel + ' fiyat: ' + price.toLocaleString('tr-TR');
}
