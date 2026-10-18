// FutBIN oyuncu bilgilerini kullanarak EA oyuncu kimligini cozer.
// Bagimliliklar: FutBIN HTTP/parser modulleri ve utils/strings.

import { normalizePlayerName } from '../utils/strings.js';
import { idOf, isBaseId, toBaseId } from './eaId.js';
import { filterCandidates, mapCandidate } from './candidateMatcher.js';

const SPECIAL_OFFSET = 0x1000000;
const eaIdFrom = (value) => (Number(value) || 0) & 0xffffff;

export function isStandardRow(row) {
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

export function queryFutbinPlayersByName(name) {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      reject(new Error('FutBIN oyuncu eşleştirmesi için userscript izni bulunamadı.'));
      return;
    }
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      resolve([]);
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
          resolve(Array.isArray(payload?.data) ? payload.data : []);
        } catch (error) {
          reject(error);
        }
      },
      onerror: () => reject(new Error('FutBIN oyuncu eşleştirme bağlantısı kurulamadı.')),
      ontimeout: () => reject(new Error('FutBIN oyuncu eşleştirme isteği zaman aşımına uğradı.'))
    });
  });
}

export function fetchFutbinPlayerId(target) {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      reject(new Error('FutBIN oyuncu eşleştirmesi için userscript izni bulunamadı.'));
      return;
    }

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

    const search = (index) => {
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

      const url = 'https://www.futbin.org/futbin/api/searchPlayersByName?playername=' + encodeURIComponent(searches[index]);
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
            if (!payload || !Array.isArray(payload.data)) throw new Error('FutBIN API data listesi bulunamadı.');
            lastRows = payload.data;
            console.log('[FutRUSH:futbin] API response status:', response.status, 'data length:', payload.data.length, 'wantsSpecial:', wantsSpecial);

            if (wantsSpecialRarity) {
              const matched = filterCandidates(payload.data, {
                playerId: targetPlayerId,
                rarityIds,
                quality: target.quality,
                wantsSpecial
              });
              console.log('[FutRUSH:futbin] filterCandidates matched count:', matched.length, 'candidates:', JSON.stringify(matched.map((c) => ({ id: c.futbinId, eaId: c.eaId, rating: c.rating, label: c.versionLabel }))));
              if (matched.length > 1) {
                resolve({
                  status: 'ambiguous',
                  candidates: matched,
                  name: targetName
                });
                return;
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

            const candidates = payload.data
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
        },
        onerror: () => reject(new Error('FutBIN oyuncu eşleştirme bağlantısı kurulamadı.')),
        ontimeout: () => reject(new Error('FutBIN oyuncu eşleştirme isteği zaman aşımına uğradı.'))
      });
    };

    search(0);
  });
}
