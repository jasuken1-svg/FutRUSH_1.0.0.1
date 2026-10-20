// FutBIN arama sonuclarindan aday kartlari filtreler ve etiketler.
// Bagimliliklar: futbin/eaId ve futbin/platform.

import { idOf, toBaseId } from './eaId.js';
import { getFutbinRowPrice } from './platform.js';

export const FUTBIN_SEASON = 'fifa27';

export function isHolo(row) {
  return Boolean(row?.holographicAnimation);
}

export function isTotwCard(row) {
  if (!row) return false;
  const raretype = Number(row.raretype ?? -1);
  if (raretype === 3 || raretype === 18) return true;
  const version = String(row.version || row.rare_name || row.card_type || '');
  return /totw|team of the week/i.test(version);
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

  if (raretype === 3) {
    return holo ? 'TOTW (Holo)' : 'TOTW (Standart)';
  }

  if (!isSpecialCard(row)) {
    return 'Base';
  }

  // Ozel / promo kartlar (raretype !== 3 && !== 18)
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

export function formatCardDisplayName(name, commonName) {
  const raw = (commonName || name || '').trim();
  if (!raw || raw.length <= 14) return raw;
  const parts = raw.split(/\s+/);
  return parts[parts.length - 1] || raw;
}

export function resolveFutbinImageUrl(rawUrl, fallback = '') {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return fallback;
  const trimmed = rawUrl.trim();
  if (/^p?\d+$/i.test(trimmed)) {
    return `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/players/${trimmed}.png`;
  }
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed;
  }
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('/design')) {
      return 'https://www.futbin.org' + trimmed;
    }
    return 'https://cdn.futbin.com' + trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return fallback || trimmed;
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

  const rawPlayerImg = row.specialPlayerImage || row.normalPlayerImage || row.image || row.special_img || row.playerimage || row.player_image || row.card_image || '';
  const playerImageFallbackUrl = (eaId && eaId > 0 && eaId >= 0x1000000)
    ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/players/p${eaId}.png`
    : (baseId ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/players/${baseId}.png` : '');
  const playerImageUrl = resolveFutbinImageUrl(rawPlayerImg, playerImageFallbackUrl);

  const rawPromoImg = row.cardImage || row.rare_card_image || row.rare_image || row.version_image || '';
  const fallbackPromoImg = (raretype && raretype > 1)
    ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/${raretype}_card.png`
    : (raretype === 1
      ? (rating >= 75
        ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/1_gold_rare.png`
        : (rating >= 65
          ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/1_silver_rare.png`
          : `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/1_bronze_rare.png`))
      : (rating >= 75
        ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/0_gold.png`
        : (rating >= 65
          ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/0_silver.png`
          : `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/0_bronze.png`)));
  const promoImageUrl = resolveFutbinImageUrl(rawPromoImg, fallbackPromoImg);

  const rawHoloAnim = row.holographicAnimation || row.card_animation || '';
  const holographicAnimationUrl = resolveFutbinImageUrl(rawHoloAnim);

  const price = getFutbinRowPrice(row) || 0;

  const isGk = position.toUpperCase() === 'GK' || position.toUpperCase() === 'KL';
  const statLabels = isGk
    ? ['DIV', 'HAN', 'KIC', 'REF', 'SPE', 'POS']
    : ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];

  const stats = (row.pac != null || row.sho != null || row.div != null) ? {
    pac: Number(isGk ? (row.div ?? row.pac) : (row.pac ?? 0)) || 0,
    sho: Number(isGk ? (row.han ?? row.sho) : (row.sho ?? 0)) || 0,
    pas: Number(isGk ? (row.kic ?? row.pas) : (row.pas ?? 0)) || 0,
    dri: Number(isGk ? (row.ref ?? row.dri) : (row.dri ?? 0)) || 0,
    def: Number(isGk ? (row.spe ?? row.def) : (row.def ?? 0)) || 0,
    phy: Number(isGk ? (row.pos ?? row.phy) : (row.phy ?? 0)) || 0,
    labels: statLabels
  } : null;

  const nationId = Number(row.nation) || 0;
  const clubId = Number(row.club) || 0;
  const leagueId = Number(row.league) || 0;

  const nationImageUrl = nationId > 0 ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/nation/${nationId}.png` : '';
  const clubImageUrl = clubId > 0 ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/clubs/dark/${clubId}.png` : '';
  const leagueImageUrl = leagueId > 0 ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/league/${leagueId}.png` : '';
  const commonName = row.common_name || row.playername || '';

  return {
    futbinId,
    eaId,
    baseId,
    playerId,
    name: commonName || row.playername || '',
    commonName,
    displayName: formatCardDisplayName(row.playername, commonName),
    rating,
    position,
    raretype,
    isHolo: holo,
    holographicAnimationUrl,
    versionLabel: getVersionLabel(row),
    playerImageUrl,
    playerImageFallbackUrl,
    promoImageUrl,
    price,
    stats,
    nationId,
    clubId,
    leagueId,
    nationImageUrl,
    clubImageUrl,
    leagueImageUrl
  };
}

export function normalizeQuality(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'g' || s === 'gold' || s === 'altın' || s === 'altin') return 'gold';
  if (s === 's' || s === 'silver' || s === 'gümüş' || s === 'gumus') return 'silver';
  if (s === 'b' || s === 'bronze' || s === 'bronz') return 'bronze';
  if (s === 'sp' || s === 'special' || s === 'özel' || s === 'ozel') return 'special';
  return s;
}

export function getQualityTier(rating) {
  const r = Number(rating) || 0;
  if (r >= 75) return 'gold';
  if (r >= 65) return 'silver';
  if (r > 0) return 'bronze';
  return null;
}

export function validateQualityFilter(cardRating, filterQuality) {
  const normFilter = normalizeQuality(filterQuality);
  if (!normFilter || normFilter === 'special') return null;
  const cardTier = getQualityTier(cardRating);
  if (!cardTier) return null;
  if (normFilter !== cardTier) {
    if (cardTier === 'gold') {
      return 'Seçilen kart kalitesi (Gold) ile pazar filtreleri (Bronz/Silver) uyuşmuyor.';
    }
    const tierName = cardTier.charAt(0).toUpperCase() + cardTier.slice(1);
    const filterName = normFilter.charAt(0).toUpperCase() + normFilter.slice(1);
    return `Seçilen kart kalitesi (${tierName}) ile pazar filtreleri (${filterName}) uyuşmuyor.`;
  }
  return null;
}

export function filterCandidates(rows, intent) {
  if (!Array.isArray(rows) || !intent) return [];

  const targetPlayerId = toBaseId(intent.playerId);
  const rarityIds = Array.isArray(intent.rarityIds) ? intent.rarityIds.map(String).filter(Boolean) : [];
  const specialRarities = rarityIds.filter((rid) => rid !== '0' && rid !== '1');
  const wantsTotw = rarityIds.includes('3');
  const wantsSpecial = wantsTotw || intent.quality === 'SP' || normalizeQuality(intent.quality) === 'special' || intent.wantsSpecial === true || specialRarities.length > 0;

  return rows
    .filter((row) => {
      if (!row) return false;
      const rowPlayerId = toBaseId(row.playerid || row.resource_id);
      if (targetPlayerId > 0 && rowPlayerId !== targetPlayerId) {
        return false;
      }

      // Kalite uyumsuzluğu kontrolü (ör. Bronz/Silver filtresinde Gold kartlar elenmeli)
      if (intent.quality) {
        const rowRating = Number(row.rating) || 0;
        const normQuality = normalizeQuality(intent.quality);
        if (normQuality && normQuality !== 'special') {
          const rowTier = getQualityTier(rowRating);
          if (rowTier && rowTier !== normQuality) {
            return false;
          }
        }
      }

      // Special / SP seçilmişse normal base kartlar elenmeli
      if (wantsSpecial && !isSpecialCard(row)) {
        return false;
      }

      // Spesifik promo / nadirlik seçilmişse:
      if (rarityIds.length > 0) {
        const rowRaretype = String(row.raretype ?? '');
        const matchesRarity = rarityIds.some((rid) => {
          if (rid === '3') {
            return isTotwCard(row);
          }
          return rowRaretype === rid;
        });
        if (!matchesRarity) {
          return false;
        }
      }

      return true;
    })
    .map(mapCandidate);
}
