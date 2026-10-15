// FutBIN oyuncu bilgilerini kullanarak EA oyuncu kimligini cozer.
// Bagimliliklar: FutBIN HTTP/parser modulleri ve utils/strings.

import { normalizePlayerName } from '../utils/strings.js';

export function fetchFutbinPlayerId(target) {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      reject(new Error('FutBIN oyuncu eşleştirmesi için userscript izni bulunamadı.'));
      return;
    }

    const targetName = String(target.name || '').trim();
    const wantedName = normalizePlayerName(targetName);
    const wantedFutbinId = String(target.futbinId || '');
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
            const candidates = payload.data
              .filter((row) => row && (Number(row.resource_id) > 0 || Number(row.playerid) > 0))
              .map((row) => {
                const names = [row.playername, row.common_name].map(normalizePlayerName).filter(Boolean);
                const exactFutbinId = wantedFutbinId && String(row.ID || row.id || '') === wantedFutbinId;
                if (index > 0 && !exactFutbinId) return { row, score: 0 };
                const exactName = names.includes(wantedName);
                const partialName = wantedName.length >= 3 && names.some((name) => name.includes(wantedName) || wantedName.includes(name));
                const ratingMatches = !target.rating || Number(row.rating) === Number(target.rating);
                const score = exactFutbinId ? 1000 : exactName && ratingMatches ? 100 : exactName ? 80 : partialName && ratingMatches ? 40 : 0;
                return { row, score };
              })
              .filter((entry) => entry.score > 0)
              .sort((a, b) => b.score - a.score);
            const candidate = candidates[0]?.row;
            const eaId = Number(candidate?.playerid) || ((Number(candidate?.resource_id) || 0) & 0xffffff);
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
