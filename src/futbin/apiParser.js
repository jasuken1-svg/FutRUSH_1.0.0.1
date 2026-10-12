import { CONFIG } from '../core/config.js';

export function parseFutbinApiPlayers(body, requestedRating) {
  let payload;
  try { payload = JSON.parse(body); } catch (error) {
    throw new Error('FutBIN API yanıtı JSON olarak çözümlenemedi.');
  }
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error('FutBIN API oyuncu listesi bulunamadı (data alanı değişmiş olabilir).');
  }
  const priceField = CONFIG.futbin.platform === 'pc' ? 'pc_LCPrice' : 'ps_LCPrice';
  const players = payload.data.map((row) => {
    const rating = Number(row.rating) || 0;
    const price = Number(row[priceField]) || 0;
    const name = String(row.playername || row.common_name || '').trim().replace(/\s+/g, ' ');
    if (!name || rating !== requestedRating || !Number.isFinite(price) || price <= 0) return null;
    return { name, rating, price, futbinId: row.ID == null ? null : String(row.ID) };
  }).filter(Boolean);
  players.pageRowCount = payload.data.length;
  return players;
}
