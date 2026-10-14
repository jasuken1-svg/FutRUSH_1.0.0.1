// Hedef oyuncu icin piyasa fiyati: findLowestBin + robustMarketPrice. EA'dan bagimsiz (search enjekte edilir).
//   const result = await getMarketPrice((maxBuy) => fetchMarketPage(eaId, maxBuy), { eaId, rating, reference, token, ...ayarlar });
// Donus: { ok, price, lowest, skipped, count, searches, exact, none, cancelled, error }

import { findLowestBin, robustMarketPrice } from './lowestBin.js';

export const getMarketPrice = async (search, {
  eaId,
  rating = 0,
  reference = 0,
  token = null,
  maxSearches = 5,
  gapMs = [1200, 1800],
  outlierRatio = 0.9,
  spread = true,
  sleepFn,
  rnd
} = {}) => {
  const baseId = (Number(eaId) || 0) & 0xffffff;
  const ratingNumber = Number(rating) || 0;
  const match = (listing) =>
    !listing.own && listing.price > 0 && listing.baseId === baseId && (!ratingNumber || listing.rating === ratingNumber);

  const options = { reference, maxSearches, gapMs, token, match, spread: spread && outlierRatio > 0 };
  if (sleepFn) options.sleepFn = sleepFn;
  if (rnd) options.rnd = rnd;
  const result = await findLowestBin(search, options);
  if (!result.ok) {
    return { ok: false, price: null, lowest: result.price, skipped: [], count: 0, searches: result.searches, exact: false, cancelled: !!result.cancelled, error: result.error };
  }
  if (!result.price) {
    return { ok: true, price: null, lowest: null, skipped: [], count: 0, searches: result.searches, exact: result.exact, none: result.none };
  }
  const market = robustMarketPrice(result, { ratio: outlierRatio });
  return {
    ok: true,
    price: market.price,
    lowest: result.price,
    skipped: market.skipped,
    count: market.count,
    searches: result.searches,
    exact: result.exact,
    none: false
  };
};
