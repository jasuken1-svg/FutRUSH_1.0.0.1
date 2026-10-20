// FutBIN platform ve fiyat okuma yardimcilari:
// getPlatform() secili platformu ('ps' veya 'pc') dondurur.
// getFutbinRowPrice() FutBIN satirindan secili platformun fiyatini okur; eksikse null doner, diger platforma dusmez.

import { getPlatform } from '../core/prefs.js';
import { parseFutbinPrice } from '../utils/format.js';

export { getPlatform };

export function getFutbinRowPrice(row, platform = getPlatform()) {
  if (!row) return null;
  const plat = platform === 'pc' ? 'pc' : 'ps';
  const candidates = plat === 'pc'
    ? [row.pc_LCPrice, row.pc_price, row.LCPrice, row.price, row.min_price]
    : [row.ps_LCPrice, row.ps_price, row.LCPrice, row.price, row.min_price];

  for (const val of candidates) {
    if (val === undefined || val === null || val === '') continue;
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      return Math.round(val);
    }
    const parsed = parseFutbinPrice(val);
    if (parsed > 0) return parsed;
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
