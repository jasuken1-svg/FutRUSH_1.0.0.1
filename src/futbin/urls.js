// CONFIG degerlerinden FutBIN liste ve API URL'lerini olusturur.
// Bagimlilik: core/config.

import { CONFIG } from '../core/config.js';

export function buildFutbinUrl(rating, page) {
  const cfg = CONFIG.futbin;
  const url = new URL(cfg.baseUrl);
  const isPc = cfg.platform === 'pc';
  const priceParam = isPc ? cfg.pcPriceRangeParam : cfg.priceRangeParam;
  url.searchParams.set(cfg.ratingParam, rating + '-' + rating);
  url.searchParams.set('platform', isPc ? 'PC' : 'PS');
  if (cfg.version) url.searchParams.set('version', cfg.version);
  if (page > 1) url.searchParams.set(cfg.pageParam, String(page));
  else url.searchParams.delete(cfg.pageParam);
  url.searchParams.set(priceParam, cfg.priceRange);
  url.searchParams.set(cfg.sortParam, priceParam);
  url.searchParams.set(cfg.orderParam, 'asc');
  return url.toString();
}

export function buildFutbinApiUrl(rating, page) {
  const cfg = CONFIG.futbin;
  const isPc = cfg.platform === 'pc';
  const url = new URL(cfg.apiBaseUrl);
  url.searchParams.set('platform', isPc ? 'PC' : 'PS');
  url.searchParams.set('page', String(page));
  url.searchParams.set('rating', rating + '-' + rating);
  url.searchParams.set(isPc ? 'pcprice' : 'ps4price', cfg.priceRange);
  url.searchParams.set('sort', isPc ? 'pc_price' : 'ps_price');
  url.searchParams.set('order', 'asc');
  if (cfg.version) url.searchParams.set('version', cfg.version);
  return url.toString();
}
