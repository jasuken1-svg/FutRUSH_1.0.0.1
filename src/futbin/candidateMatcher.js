// FutBIN arama sonuclarindan aday kartlari filtreler ve etiketler.
// Bagimliliklar: futbin/eaId ve futbin/platform.

import { idOf, toBaseId } from './eaId.js';
import { getFutbinRowPrice } from './platform.js';

export function isHolo(row) {
  return Boolean(row?.holographicAnimation);
}

function parsePromoFromUrl(url) {
  if (typeof url !== 'string' || !url) return '';
  const match = url.match(/\/(\d+)_([a-zA-Z0-9_-]+)\.(?:png|webp|jpg|jpeg)/i);
  if (!match) return '';
  const slug = match[2].replace(/[_-]+/g, ' ').trim();
  return slug.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getVersionLabel(row) {
  const holo = isHolo(row);
  const raretype = Number(row?.raretype ?? 0);
  const isSpecial = isSpecialCard(row);

  if (raretype === 3) {
    return holo ? 'TOTW (Holo)' : 'TOTW (Standart)';
  }

  if (!isSpecial) {
    return 'Base';
  }

  // Ozel / promo kartlar (raretype !== 3)
  const rawVersion = String(row?.version || row?.rare_name || '').trim();
  let promoName = rawVersion;
  if (!promoName && row?.cardImage) {
    promoName = parsePromoFromUrl(row.cardImage);
  }
  if (!promoName && row?.rare_image) {
    promoName = parsePromoFromUrl(row.rare_image);
  }
  if (!promoName) {
    promoName = raretype > 0 ? `Promo #${raretype}` : 'Özel';
  }

  return holo ? `${promoName} (Holo)` : promoName;
}

export function isSpecialCard(row) {
  if (!row) return false;
  const resId = Number(row.resource_id) || 0;
  if (resId >= 0x1000000) return true;
  const raretype = Number(row.raretype ?? 0);
  return (raretype !== 0 && raretype !== 1) || Boolean(row.holographicAnimation);
}

export function resolveFutbinImageUrl(rawUrl, fallback = '') {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return fallback;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed;
  }
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('/design')) {
      return 'https://www.futbin.org' + trimmed;
    }
    return 'https://cdn.futbin.com' + trimmed;
  }
  return trimmed;
}

export function sortCandidatesByPriceAsc(candidates) {
  if (!Array.isArray(candidates)) return [];
  return candidates.slice().sort((a, b) => {
    const priceA = Number(a?.price) || 0;
    const priceB = Number(b?.price) || 0;
    if (priceA > 0 && priceB > 0) {
      if (priceA !== priceB) return priceA - priceB;
      return (Number(a?.rating) || 0) - (Number(b?.rating) || 0);
    }
    if (priceA > 0 && priceB <= 0) return -1;
    if (priceA <= 0 && priceB > 0) return 1;
    return (Number(a?.rating) || 0) - (Number(b?.rating) || 0);
  });
}

export function mapCandidate(row) {
  if (!row) return null;
  const eaId = Number(row.resource_id) || Number(row.playerid) || idOf(row.resource_id) || idOf(row.playerid);
  const baseId = toBaseId(row.playerid || row.resource_id);
  const playerId = baseId;
  const rating = Number(row.rating) || 0;
  const futbinId = String(row.ID ?? row.id ?? '');
  const holo = isHolo(row);
  const raretype = Number(row.raretype ?? 0);
  const position = String(row.position || '').trim();

  const rawPlayerImg = row.image || row.player_image || row.special_img || row.specialPlayerImage || row.card_image || '';
  const fallbackPlayerImg = (eaId && eaId > 0)
    ? `https://cdn.futbin.com/content/fifa27/img/players/p${eaId}.png`
    : (baseId ? `https://cdn.futbin.com/content/fifa27/img/players/p${baseId}.png` : '');
  const playerImageUrl = resolveFutbinImageUrl(rawPlayerImg, fallbackPlayerImg);

  const rawPromoImg = row.rare_image || row.version_image || row.cardImage || row.rare_card_image || '';
  const fallbackPromoImg = (raretype && raretype > 0)
    ? `https://cdn.futbin.com/content/fifa27/img/cards/hd/${raretype}_card.png`
    : '';
  const promoImageUrl = resolveFutbinImageUrl(rawPromoImg, fallbackPromoImg);

  const price = getFutbinRowPrice(row) || 0;

  return {
    futbinId,
    eaId,
    baseId,
    playerId,
    name: row.playername || row.common_name || '',
    rating,
    position,
    raretype,
    isHolo: holo,
    versionLabel: getVersionLabel(row),
    playerImageUrl,
    promoImageUrl,
    price,
    raw: row
  };
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
