// FutBIN oyuncu listesi HTML'ini oyuncu ve sayfalama verilerine ayrıştırır.
// Bagimliliklar: DOMParser ve utils/format.

import { CONFIG } from '../core/config.js';
import { parseFutbinPrice } from '../utils/format.js';

export function parseFutbinPlayers(html, requestedRating) {
  const cfg = CONFIG.futbin;
  const selectors = cfg.selectors;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const pageText = (doc.body?.textContent || '').slice(0, 4000);
  const hasPlayerRows = doc.querySelector(selectors.rows) !== null;
  const blockedPattern = /<title>\s*just a moment|cf-browser-verification|cf_chl_opt|cf-chl-|challenge-platform\/h\/|id=["']challenge-(?:form|running|body-text|stage)["']|enable javascript and cookies to continue|oops, there was an error - 403|attention required/i;
  if (!hasPlayerRows && (blockedPattern.test(html) || /just a moment|attention required/i.test(pageText))) {
    const error = new Error('FutBIN isteği engellendi (Cloudflare). Bir süre sonra tekrar deneyin.');
    error.blocked = true;
    throw error;
  }
  const rows = Array.from(doc.querySelectorAll(selectors.rows));
  if (!rows.length) {
    if (doc.querySelector(selectors.emptyResultContainer)) {
      const emptyResult = [];
      emptyResult.pageRowCount = 0;
      return emptyResult;
    }
    throw new Error('FutBIN oyuncu satırları bulunamadı; rows seçicisini kontrol edin: ' + selectors.rows);
  }

  const priceSelector = cfg.platform === 'pc' ? selectors.pcPrice : selectors.consolePrice;
  let lastPage = 0;
  doc.querySelectorAll(selectors.pageLinks).forEach((link) => {
    try { lastPage = Math.max(lastPage, Number(new URL(link.href, cfg.baseUrl).searchParams.get(cfg.pageParam)) || 0); } catch (e) {}
  });
  const players = rows.map((row) => {
    const link = row.querySelector(selectors.nameLink);
    const nameNode = link || row.querySelector(selectors.name);
    const name = (nameNode?.textContent || nameNode?.getAttribute('data-player-name') || '').trim().replace(/\s+/g, ' ');
    if (!name) return null;

    const ratingNode = row.querySelector(selectors.rating);
    const ratingText = ratingNode?.textContent || row.querySelector(selectors.ratingFallback)?.textContent || '';
    const ratingMatch = String(ratingText).match(/\b(\d{2})\b/);
    const rating = ratingMatch ? Number(ratingMatch[1]) : 0;
    if (rating !== requestedRating) return null;

    const priceNode = row.querySelector(priceSelector);
    const price = parseFutbinPrice(priceNode?.textContent || '');
    if (!price) return null;
    const href = link?.getAttribute('href') || '';
    const idMatch = href.match(selectors.idPattern);
    const image = row.querySelector(selectors.image);
    return { name, rating, price, futbinId: idMatch ? idMatch[1] : null, eaId: image?.getAttribute('src') || null };
  }).filter(Boolean);
  players.pageRowCount = rows.length;
  players.lastPage = lastPage;
  return players;
}
