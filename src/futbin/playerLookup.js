// FutBIN oyuncu bilgilerini kullanarak EA oyuncu kimligini cozer.
// Bagimliliklar: FutBIN HTTP/parser modulleri ve utils/strings.

import { normalizePlayerName } from '../utils/strings.js';

const SPECIAL_OFFSET = 0x1000000;
const eaIdFrom = (value) => (Number(value) || 0) & 0xffffff;

function isStandardRow(row) {
  const resourceId = Number(row.resource_id);
  const playerId = Number(row.playerid);
  const id = resourceId > 0 ? resourceId : playerId;
  return id > 0 && id < SPECIAL_OFFSET;
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
    const preferStandard = target.preferStandard !== false && !selectedCardId;
    const fallbackTerms = wantedFutbinId
      ? [...new Set(targetName.split(/\s+/).reverse().filter((part) => part.length >= 3))].slice(0, 3)
      : [];
    const searches = [targetName, ...fallbackTerms].filter((name, index, all) => name && all.indexOf(name) === index);
    let lastRows = [];

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
            const hasSelectedEaMatch = selectedCardId && payload.data.some((row) =>
              row && (eaIdFrom(row.resource_id) === selectedCardId || eaIdFrom(row.playerid) === selectedCardId)
            );
            const candidates = payload.data
              .filter((row) => row && (Number(row.resource_id) > 0 || Number(row.playerid) > 0))
              .map((row) => {
                const names = [row.playername, row.common_name].map(normalizePlayerName).filter(Boolean);
                const exactFutbinId = wantedFutbinId && String(row.ID || row.id || '') === wantedFutbinId;
                const resourceId = eaIdFrom(row.resource_id);
                const playerId = eaIdFrom(row.playerid);
                const selectedResourceMatches = selectedCardId && resourceId === selectedCardId;
                const selectedPlayerMatches = selectedCardId && playerId === selectedCardId;
                if (selectedCardId && !selectedResourceMatches && !selectedPlayerMatches) return { row, score: 0 };
                if (index > 0 && !selectedCardId && !exactFutbinId) return { row, score: 0 };
                const exactName = names.includes(wantedName);
                const partialName = wantedName.length >= 3 && names.some((name) => name.includes(wantedName) || wantedName.includes(name));
                const ratingMatches = !target.rating || Number(row.rating) === Number(target.rating);
                const nameScore = exactName
                  ? (ratingMatches ? 100 : 80)
                  : partialName
                    ? (ratingMatches ? 40 : 20)
                    : 0;
                const standardScore = preferStandard && nameScore > 0 && isStandardRow(row)
                  ? 1200 + nameScore
                  : 0;
                const score = selectedResourceMatches
                  ? 3000 + nameScore
                  : selectedPlayerMatches
                    ? 2000 + nameScore
                    : standardScore
                      ? standardScore
                    : exactFutbinId && !selectedCardId && !hasSelectedEaMatch
                      ? 1000
                      : nameScore;
                return { row, score };
              })
              .filter((entry) => entry.score > 0)
              .sort((a, b) => b.score - a.score);
            const candidate = candidates[0]?.row;
            const eaId = eaIdFrom(candidate?.resource_id) || eaIdFrom(candidate?.playerid);
            if (!eaId) {
              search(index + 1);
              return;
            }
            if (!target.rating && Number(candidate.rating) > 0) target.rating = Number(candidate.rating);
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
