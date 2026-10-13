// FutBIN HTML/API kaynaklarindan en ucuz oyunculari sayfalayarak yukler.
// Bagimliliklar: core/config, utils/async, futbin/urls, http ve parser modulleri.

import { CONFIG } from '../core/config.js';
import { wait } from '../utils/async.js';
import { buildFutbinApiUrl, buildFutbinUrl } from './urls.js';
import { requestFutbinApi, requestFutbinPage } from './http.js';
import { parseFutbinApiPlayers } from './apiParser.js';
import { parseFutbinPlayers } from './htmlParser.js';

async function loadFromFutbinApi(rating, count) {
  const found = new Map();
  for (let page = 1; page <= CONFIG.futbin.maxPages && found.size < count; page++) {
    if (page > 1) await wait(CONFIG.futbin.pageDelay);
    const url = buildFutbinApiUrl(rating, page);
    const response = await requestFutbinApi(url);
    if (response.status === 403 || response.status === 429 || response.status === 503) {
      console.error('[FutRUSH] FutBIN API isteği engellendi:', response.status, url, (response.responseText || '').slice(0, 500));
      const error = new Error('FutBIN isteği engellendi (' + response.status + '). Bir süre sonra tekrar deneyin.');
      error.blocked = true;
      throw error;
    }
    if (response.status < 200 || response.status >= 300) throw new Error('FutBIN API yanıt vermedi (HTTP ' + response.status + ').');
    const players = parseFutbinApiPlayers(response.responseText || '', rating);
    players.forEach((player) => {
      const key = player.futbinId ? 'id:' + player.futbinId : 'name:' + player.name.toLocaleLowerCase() + ':' + player.rating;
      if (!found.has(key)) found.set(key, player);
    });
    if (!players.pageRowCount) break;
  }
  return Array.from(found.values()).sort((a, b) => a.price - b.price).slice(0, count);
}

async function loadFromFutbinPage(rating, count) {
  const found = new Map();
  let lastPage = CONFIG.futbin.maxPages;
  for (let page = 1; page <= CONFIG.futbin.maxPages && found.size < count && page <= lastPage; page++) {
    if (page > 1) await wait(CONFIG.futbin.pageDelay);
    const url = buildFutbinUrl(rating, page);
    let response;
    try { response = await requestFutbinPage(url); } catch (error) {
      console.error('[FutRUSH] FutBIN isteği başarısız:', url, error);
      throw error;
    }
    const body = response.responseText || '';
    if (response.status === 403 || response.status === 429 || response.status === 503 || /cloudflare|cf-chl|just a moment|attention required/i.test(body.slice(0, 4000))) {
      const error = new Error('FutBIN sayfası engellendi (' + response.status + ').');
      error.blocked = true;
      error.status = response.status;
      error.url = url;
      throw error;
    }
    if (response.status < 200 || response.status >= 300) {
      console.error('[FutRUSH] FutBIN HTTP hatası:', response.status, url);
      throw new Error('FutBIN yanıt vermedi (HTTP ' + response.status + ').');
    }
    let players;
    try { players = parseFutbinPlayers(body, rating); } catch (error) {
      console.error('[FutRUSH] FutBIN HTML ayrıştırılamadı:', url, error);
      throw error;
    }
    players.forEach((player) => {
      const key = player.futbinId ? 'id:' + player.futbinId : 'name:' + player.name.toLocaleLowerCase() + ':' + player.rating;
      if (!found.has(key)) found.set(key, player);
    });
    if (players.lastPage) lastPage = Math.min(CONFIG.futbin.maxPages, players.lastPage);
    if (players.pageRowCount === 0) break;
  }
  const players = Array.from(found.values()).sort((a, b) => a.price - b.price).slice(0, count);
  if (!players.length) throw new Error('Seçilen reytingde FutBIN fiyatı bulunan oyuncu yok.');
  return players;
}

function noPlayersError() {
  return new Error('Seçilen reytingde FutBIN fiyatı bulunan oyuncu yok.');
}

export async function fetchCheapestPlayers(rating, count) {
  if (CONFIG.futbin.preferApi) {
    let apiError;
    try {
      const players = await loadFromFutbinApi(rating, count);
      if (!players.length) throw noPlayersError();
      return { players, source: 'api', fallback: false };
    } catch (error) {
      apiError = error;
      console.warn('[FutRUSH] FutBIN API başarısız; sayfa yedeği deneniyor:', error);
    }

    try {
      const players = await loadFromFutbinPage(rating, count);
      return { players, source: 'html', fallback: true };
    } catch (pageError) {
      pageError.blocked = Boolean(apiError.blocked && pageError.blocked);
      throw pageError;
    }
  }

  try {
    const players = await loadFromFutbinPage(rating, count);
    return { players, source: 'html', fallback: false };
  } catch (pageError) {
    if (!pageError.blocked) throw pageError;
    console.warn('[FutRUSH] FutBIN sayfası engellendi; MagicBuyer uyumlu liste API yedeği deneniyor:', pageError.status, pageError.url);
    try {
      const players = await loadFromFutbinApi(rating, count);
      if (!players.length) throw noPlayersError();
      return { players, source: 'api', fallback: true };
    } catch (apiError) {
      apiError.blocked = Boolean(pageError.blocked && apiError.blocked);
      throw apiError;
    }
  }
}
