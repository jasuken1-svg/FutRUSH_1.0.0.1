// FutBIN arama sonuclarindan aday kartlari filtreler ve etiketler.
// Bagimliliklar: futbin/eaId.

import { idOf, toBaseId } from './eaId.js';

export function isHolo(row) {
  return Boolean(row?.holographicAnimation);
}

export function getVersionLabel(row) {
  const holo = isHolo(row);
  const raretype = String(row?.raretype ?? '');
  if (raretype === '3') {
    return holo ? 'TOTW (Holo)' : 'TOTW (Standart)';
  }
  return holo ? 'Özel (Holo)' : 'Standart';
}

export function mapCandidate(row) {
  if (!row) return null;
  const eaId = idOf(row.resource_id) || idOf(row.playerid);
  const playerId = toBaseId(row.playerid || row.resource_id);
  const rating = Number(row.rating) || 0;
  const futbinId = String(row.ID ?? row.id ?? '');
  const holo = isHolo(row);
  return {
    futbinId,
    eaId,
    playerId,
    name: row.playername || row.common_name || '',
    rating,
    isHolo: holo,
    versionLabel: getVersionLabel(row),
    raretype: String(row.raretype ?? ''),
    raw: row
  };
}

export function isSpecialCard(row) {
  if (!row) return false;
  const resId = Number(row.resource_id) || 0;
  if (resId >= 0x1000000) return true;
  const raretype = String(row.raretype ?? '');
  return raretype === '3' || raretype === '18' || Boolean(row.holographicAnimation);
}

export function filterCandidates(rows, intent) {
  if (!Array.isArray(rows) || !intent) return [];

  const targetPlayerId = toBaseId(intent.playerId);
  const wantsTotw = Array.isArray(intent.rarityIds) && intent.rarityIds.map(String).includes('3');
  const wantsSpecial = wantsTotw || intent.quality === 'SP' || intent.wantsSpecial === true;

  return rows
    .filter((row) => {
      if (!row) return false;
      const rowPlayerId = toBaseId(row.playerid || row.resource_id);
      if (targetPlayerId > 0 && rowPlayerId !== targetPlayerId) {
        return false;
      }
      if (wantsSpecial && !isSpecialCard(row)) {
        return false;
      }
      if (wantsTotw) {
        const raretype = String(row.raretype ?? '');
        const version = String(row.version ?? row.card_type ?? '');
        return raretype === '3' || raretype === '18' || /totw|team of the week/i.test(version) || isSpecialCard(row);
      }
      return true;
    })
    .map(mapCandidate);
}
