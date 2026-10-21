// FutBIN oyuncu API yanitini hedef oyuncu kayitlarina donusturur.
// Bagimlilik: yalnizca JSON/metin ayrıştırma ve utils/format.

import { CONFIG } from '../core/config.js';
import { mapCandidate } from './candidateMatcher.js';

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
    const commonName = String(row.common_name || '').trim().replace(/\s+/g, ' ');
    const fullName = String(row.playername || '').trim().replace(/\s+/g, ' ');
    const name = commonName || fullName;
    if (!name || rating !== requestedRating || !Number.isFinite(price) || price <= 0) return null;

    if (row.resource_id || row.playerid || row.league || row.club || row.nation) {
      const candidate = mapCandidate(row);
      if (candidate) {
        return {
          ...candidate,
          name,
          commonName: commonName || name,
          price
        };
      }
    }
    return { name, rating, price, futbinId: row.ID == null ? null : String(row.ID) };
  }).filter(Boolean);
  players.pageRowCount = payload.data.length;
  return players;
}
