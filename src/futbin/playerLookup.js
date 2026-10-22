// FutBIN oyuncu bilgilerini kullanarak EA oyuncu kimligini cozer.
// Bagimliliklar: FutBIN HTTP/parser modulleri ve utils/strings.

import { normalizePlayerName } from '../utils/strings.js';
import { idOf, isBaseId, toBaseId } from './eaId.js';
import { filterCandidates, mapCandidate, sortCandidatesByPriceAsc, normalizeQuality, validateQualityFilter, isSpecialCard } from './candidateMatcher.js';
import { CONFIG } from '../core/config.js';
import { requestFutbinApi } from './http.js';

const SPECIAL_OFFSET = 0x1000000;
const eaIdFrom = (value) => (Number(value) || 0) & 0xffffff;

function isStandardRow(row) {
  const resourceId = Number(row.resource_id);
  const playerId = Number(row.playerid);
  const id = resourceId > 0 ? resourceId : playerId;
  return id > 0 && id < SPECIAL_OFFSET;
}

export function scoreRow(row, {
  wantedName = '',
  wantedFutbinId = '',
  selectedCardId = 0,
  preferStandard = true,
  targetRating = 0,
  index = 0
} = {}) {
  if (!row) return 0;
  const rawResourceId = Number(row.resource_id) || 0;
  const rawPlayerId = Number(row.playerid) || 0;
  if (!rawResourceId && !rawPlayerId) return 0;

  const cardId = Number(selectedCardId) || 0;
  const isBase = isBaseId(cardId);
  const resourceId = idOf(row.resource_id);
  const playerId = idOf(row.playerid);
  const resourceMasked = eaIdFrom(row.resource_id);
  const playerMasked = eaIdFrom(row.playerid);

  const selectedResourceMatches = Boolean(cardId && (resourceId === cardId || resourceMasked === cardId));
  const selectedPlayerMatches = Boolean(cardId && isBase && (playerId === cardId || playerMasked === cardId));

  if (cardId && !selectedResourceMatches && !selectedPlayerMatches) return 0;

  const exactFutbinId = Boolean(wantedFutbinId && String(row.ID || row.id || '') === String(wantedFutbinId));
  if (index > 0 && !cardId && !exactFutbinId) return 0;

  const names = [row.playername, row.common_name].map(normalizePlayerName).filter(Boolean);
  const exactName = wantedName ? names.includes(wantedName) : true;
  const partialName = wantedName && wantedName.length >= 3 && names.some((name) => name.includes(wantedName) || wantedName.includes(name));

  if (wantedName && !exactName && !partialName && !exactFutbinId && !selectedResourceMatches) {
    return 0;
  }

  const ratingMatches = !targetRating || Number(row.rating) === Number(targetRating);
  const nameScore = exactName
    ? (ratingMatches ? 100 : 80)
    : partialName
      ? (ratingMatches ? 40 : 20)
      : 0;

  if (selectedResourceMatches) {
    return 4000 + nameScore;
  }
  if (exactFutbinId && !cardId) {
    return 2500 + nameScore;
  }
  if (selectedPlayerMatches) {
    return 2000 + nameScore;
  }
  if (preferStandard && !cardId && isStandardRow(row)) {
    return 1200 + nameScore;
  }
  return nameScore;
}

const searchCache = new Map();
const detailsCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

export function clearFutbinSearchCache() {
  searchCache.clear();
  detailsCache.clear();
}

export async function fetchPlayerDetailsFromFutbinApi({ name = '', rating = 0, eaId = 0, futbinId = '' } = {}) {
  const cacheKey = `${eaId || futbinId || normalizePlayerName(name)}_${rating}`;
  const cached = detailsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  const cfg = CONFIG.futbin;
  const isPc = cfg.platform === 'pc';

  // 1. search parametresi ile getFilteredPlayers sorgula
  if (name) {
    try {
      const searchUrl = new URL(cfg.apiBaseUrl);
      searchUrl.searchParams.set('platform', isPc ? 'PC' : 'PS');
      searchUrl.searchParams.set('page', '1');
      searchUrl.searchParams.set('search', String(name).trim());
      if (rating) searchUrl.searchParams.set('rating', `${rating}-${rating}`);
      const res = await requestFutbinApi(searchUrl.toString());
      if (res && res.status >= 200 && res.status < 300) {
        const payload = JSON.parse(res.responseText || '{}');
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          const matchedRow = payload.data.find((row) =>
            (eaId && (Number(row.resource_id) === Number(eaId) || Number(row.playerid) === Number(eaId))) ||
            (futbinId && String(row.ID ?? row.id) === String(futbinId)) ||
            (rating && Number(row.rating) === Number(rating))
          ) || payload.data[0];
          if (matchedRow) {
            const candidate = mapCandidate(matchedRow);
            if (candidate) {
              detailsCache.set(cacheKey, { data: candidate, timestamp: Date.now() });
              return candidate;
            }
          }
        }
      }
    } catch (_) {}
  }

  // 2. Reyting biliniyorsa doğrudan reyting sayfasından sorgula (getFilteredPlayers API)
  if (rating > 0) {
    try {
      const ratingUrl = new URL(cfg.apiBaseUrl);
      ratingUrl.searchParams.set('platform', isPc ? 'PC' : 'PS');
      ratingUrl.searchParams.set('page', '1');
      ratingUrl.searchParams.set('rating', `${rating}-${rating}`);
      ratingUrl.searchParams.set(isPc ? 'pcprice' : 'ps4price', cfg.priceRange);
      ratingUrl.searchParams.set('sort', isPc ? 'pc_price' : 'ps_price');
      ratingUrl.searchParams.set('order', 'asc');
      const res = await requestFutbinApi(ratingUrl.toString());
      if (res && res.status >= 200 && res.status < 300) {
        const payload = JSON.parse(res.responseText || '{}');
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          const normWanted = name ? normalizePlayerName(name) : '';
          const matchedRow = payload.data.find((row) => {
            if (eaId && (Number(row.resource_id) === Number(eaId) || Number(row.playerid) === Number(eaId))) return true;
            if (futbinId && String(row.ID ?? row.id) === String(futbinId)) return true;
            if (normWanted) {
              const rowName = normalizePlayerName(row.playername || row.common_name || '');
              return rowName === normWanted || rowName.includes(normWanted) || normWanted.includes(rowName);
            }
            return false;
          });
          if (matchedRow) {
            const candidate = mapCandidate(matchedRow);
            if (candidate) {
              detailsCache.set(cacheKey, { data: candidate, timestamp: Date.now() });
              return candidate;
            }
          }
        }
      }
    } catch (_) {}
  }

  return null;
}

export function queryFutbinPlayersByName(name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    return Promise.resolve([]);
  }
  const key = normalizePlayerName(cleanName);
  const cached = searchCache.get(key);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return Promise.resolve(cached.data);
  }

  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      reject(new Error('FutBIN oyuncu eşleştirmesi için userscript izni bulunamadı.'));
      return;
    }
    const url = 'https://www.futbin.org/futbin/api/searchPlayersByName?playername=' + encodeURIComponent(cleanName);
    GM_xmlhttpRequest({
      method: 'GET', url, timeout: 15000,
      headers: { 'Accept': 'application/json, text/plain, */*' },
      onload: (response) => {
        if (response.status < 200 || response.status >= 300) {
          reject(new Error('FutBIN oyuncu eşleştirme isteği başarısız (HTTP ' + response.status + ').'));
          return;
        }
        try {
          const payload = JSON.parse(response.responseText || '');
          const data = Array.isArray(payload?.data) ? payload.data : [];
          searchCache.set(key, { data, timestamp: Date.now() });
          resolve(data);
        } catch (error) {
          reject(error);
        }
      },
      onerror: () => reject(new Error('FutBIN oyuncu eşleştirme bağlantısı kurulamadı.')),
      ontimeout: () => reject(new Error('FutBIN oyuncu eşleştirme isteği zaman aşımına uğradı.'))
    });
  });
}

export async function searchPlayerAllVersions(name) {
  const rows = await queryFutbinPlayersByName(name);
  if (!Array.isArray(rows) || !rows.length) return [];
  const candidates = rows.map(mapCandidate).filter(Boolean);
  return sortCandidatesByPriceAsc(candidates);
}

export async function searchUniquePlayers(name) {
  const rows = await queryFutbinPlayersByName(name);
  if (!Array.isArray(rows) || !rows.length) return [];

  const playerMap = new Map();

  for (const row of rows) {
    if (!row) continue;
    const baseId = toBaseId(row.playerid || row.resource_id);
    const candidate = mapCandidate(row);
    if (!candidate) continue;

    const groupKey = baseId > 0 ? `id_${baseId}` : `name_${normalizePlayerName(candidate.name)}`;
    if (!playerMap.has(groupKey)) {
      playerMap.set(groupKey, {
        baseId,
        name: candidate.name,
        highestRating: candidate.rating,
        baseRating: candidate.rating,
        versions: [candidate]
      });
    } else {
      const group = playerMap.get(groupKey);
      group.versions.push(candidate);
      if (candidate.rating > group.highestRating) {
        group.highestRating = candidate.rating;
      }
    }
  }

  const players = Array.from(playerMap.values());

  players.forEach((player) => {
    player.versions = sortCandidatesByPriceAsc(player.versions);
    // Base karti bul: oncelik !isSpecialCard veya versionLabel === 'Base'
    const baseCandidate = player.versions.find((v) => !isSpecialCard(v.raw) || v.versionLabel === 'Base');
    if (baseCandidate) {
      player.baseRating = Number(baseCandidate.rating) || 0;
      player.baseCard = baseCandidate;
      if (baseCandidate.name) player.name = baseCandidate.name;
    } else {
      const minRating = Math.min(...player.versions.map((v) => Number(v.rating) || 0));
      player.baseRating = minRating > 0 ? minRating : player.highestRating;
      player.baseCard = player.versions[0];
    }
  });

  // Oyuncu arama siralamasi her zaman Base kart yuksek reyting > dusuk reyting seklinde
  players.sort((a, b) => {
    const diff = (Number(b.baseRating) || 0) - (Number(a.baseRating) || 0);
    if (diff !== 0) return diff;
    const highestDiff = (Number(b.highestRating) || 0) - (Number(a.highestRating) || 0);
    if (highestDiff !== 0) return highestDiff;
    return a.name.localeCompare(b.name);
  });

  return players;
}

export function fetchFutbinPlayerId(target) {
  return new Promise((resolve, reject) => {
    const targetName = String(target.name || '').trim();
    const wantedName = normalizePlayerName(targetName);
    const wantedFutbinId = String(target.futbinId || '');
    const selectedCardId = eaIdFrom(target.selectedCardId);
    const rarityIds = Array.isArray(target.rarityIds) ? target.rarityIds.map(String) : [];
    const wantsSpecial = target.quality === 'SP' || target.wantsSpecial === true || rarityIds.length > 0;
    const wantsSpecialRarity = wantsSpecial;
    const preferStandard = target.preferStandard !== false && !selectedCardId && !wantsSpecial;
    const targetPlayerId = toBaseId(target.playerId || selectedCardId);
    const fallbackTerms = wantedFutbinId
      ? [...new Set(targetName.split(/\s+/).reverse().filter((part) => part.length >= 3))].slice(0, 3)
      : [];
    const searches = [targetName, ...fallbackTerms].filter((name, index, all) => name && all.indexOf(name) === index);
    let lastRows = [];

    console.log('[FutRUSH:futbin] Lookup start:', JSON.stringify({ targetName, targetPlayerId, rarityIds, wantsSpecial }));

    const search = async (index) => {
      if (index >= searches.length) {
        console.warn('[FutRUSH] FutBIN eşleşme yanıtı:', {
          name: target.name, rating: target.rating, futbinId: target.futbinId, rows: lastRows.slice(0, 8)
        });
        const detail = target.futbinId
          ? ' FutBIN kart kimliği ' + target.futbinId + ' ve oyuncu adı eşleşmedi.'
          : selectedCardId
            ? ' Seçili kart kimliği ' + selectedCardId + ', oyuncu adı ve reytingle eşleşmedi.'
            : ' Oyuncu adı: ' + String(target.name || '(boş)') + (target.rating ? ', reyting: ' + target.rating : '') + '.';
        reject(new Error('FutBIN yanıtında eşleşen EA oyuncu kimliği bulunamadı.' + detail));
        return;
      }

      try {
        const rows = await queryFutbinPlayersByName(searches[index]);
        lastRows = rows;
        console.log('[FutRUSH:futbin] API response data length:', rows.length, 'wantsSpecial:', wantsSpecial);

        if (target.quality) {
          const normQuality = normalizeQuality(target.quality);
          if (normQuality && normQuality !== 'special') {
            const playerRows = targetPlayerId > 0
              ? rows.filter((r) => toBaseId(r.playerid || r.resource_id) === targetPlayerId)
              : rows.filter((r) => wantedName && [r.playername, r.common_name].map(normalizePlayerName).filter(Boolean).some((n) => n === wantedName || wantedName.includes(n) || n.includes(wantedName)));

            if (playerRows.length > 0) {
              const maxRating = Math.max(...playerRows.map((r) => Number(r.rating) || 0));
              const conflict = validateQualityFilter(maxRating, target.quality);
              if (conflict) {
                reject(new Error(conflict));
                return;
              }
            }
          }
        }

        if (wantsSpecialRarity) {
          const matched = filterCandidates(rows, {
            playerId: targetPlayerId,
            rarityIds,
            quality: target.quality,
            wantsSpecial
          });
          console.log('[FutRUSH:futbin] filterCandidates matched count:', matched.length, 'candidates:', JSON.stringify(matched.map((c) => ({ id: c.futbinId, eaId: c.eaId, rating: c.rating, label: c.versionLabel }))));

          const wantsTotw = rarityIds.includes('3');
          if (wantsTotw) {
            if (matched.length > 1) {
              resolve({
                status: 'ambiguous',
                candidates: matched,
                name: targetName
              });
              return;
            }
          } else {
            // TOTW Harici Promo Seçimi
            if (matched.length === 1) {
              const c = matched[0];
              resolve(target.returnDetails ? {
                status: 'ok',
                eaId: c.eaId,
                rating: c.rating,
                candidate: c
              } : c.eaId);
              return;
            }
            if (matched.length > 1 && target.rating) {
              const ratingMatches = matched.filter((c) => Number(c.rating) === Number(target.rating));
              if (ratingMatches.length === 1) {
                const c = ratingMatches[0];
                resolve(target.returnDetails ? {
                  status: 'ok',
                  eaId: c.eaId,
                  rating: c.rating,
                  candidate: c
                } : c.eaId);
                return;
              }
              if (ratingMatches.length > 1) {
                resolve({
                  status: 'ambiguous',
                  candidates: sortCandidatesByPriceAsc(ratingMatches),
                  name: targetName
                });
                return;
              }
            }
            if (matched.length > 1) {
              resolve({
                status: 'ambiguous',
                candidates: sortCandidatesByPriceAsc(matched),
                name: targetName
              });
              return;
            }
          }

          if (matched.length === 1) {
            const c = matched[0];
            resolve(target.returnDetails ? {
              status: 'ok',
              eaId: c.eaId,
              rating: c.rating,
              candidate: c
            } : c.eaId);
            return;
          }
          search(index + 1);
          return;
        }

        const candidates = rows
          .map((row) => ({
            row,
            score: scoreRow(row, {
              wantedName,
              wantedFutbinId,
              selectedCardId,
              preferStandard,
              targetRating: target.rating,
              index
            })
          }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score);
        const candidate = candidates[0]?.row;
        const eaId = eaIdFrom(candidate?.resource_id) || eaIdFrom(candidate?.playerid);
        if (!eaId) {
          search(index + 1);
          return;
        }
        if (!target.rating && Number(candidate.rating) > 0) target.rating = Number(candidate.rating);
        if (target.returnDetails) {
          resolve({
            status: 'ok',
            eaId,
            rating: Number(candidate.rating) || 0,
            candidate: mapCandidate(candidate)
          });
          return;
        }
        resolve(eaId);
      } catch (error) {
        reject(error);
      }
    };

    search(0);
  });
}
