// FutBIN oyuncularini yukler; istege gore EA piyasa fiyatini alip hedeflere ekler.
// Bagimliliklar: core state/events/config, ea pricing, futbin loader ve targets.

import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { CONFIG } from '../core/config.js';
import { info, warnOnce } from '../core/logger.js';
import { getMarketPrice } from '../ea/marketPrice.js';
import { fetchMarketPage } from '../ea/marketPage.js';
import { actionGap, createCancelToken } from '../utils/cancelToken.js';
import { fetchCheapestPlayers } from '../futbin/loader.js';
import { mergeTargetPlayers, resolveTargetEaId } from './targetOps.js';

let activeToken = null;

function importStatus(added, fallback, fallbackCount, total) {
  let message = added ? added + ' oyuncu hedef listesine eklendi' : 'Bulunan oyuncular zaten hedef listesinde';
  if (fallback) message += ' (FutBIN yedek kaynağı)';
  if (fallbackCount === 0 && total > 0) message += ' (fiyatlar EA\'dan)';
  else if (fallbackCount > 0 && fallbackCount < total) message += ' (' + fallbackCount + ' oyuncuda FutBIN fiyatı kullanıldı)';
  else if (fallbackCount === total && total > 0) message += ' (' + fallbackCount + ' oyuncuda FutBIN fiyatı kullanıldı)';
  return message + '.';
}

async function importWithEaPrices(players, fallback, token, fetchPage, sleepFn) {
  let added = 0;
  let fallbackCount = 0;
  let consecutiveErrors = 0;
  let stopEaSearch = false;
  const settings = CONFIG.targetAdd;

  if (activeToken === token) state.targetLoading = false;
  for (let index = 0; index < players.length; index++) {
    const player = players[index];
    let didEaSearch = false;
    let usedEaPrice = false;
    const reference = player.price;

    if (activeToken === token) {
      state.targetStatus = { type: 'loading', message: 'EA fiyatı alınıyor ' + (index + 1) + '/' + players.length + ': ' + player.name };
      emit('targets:changed');
    }

    if (!token.cancelled && !state.botRunning && !stopEaSearch) {
      let eaId = Number(player.eaId) > 0 ? Number(player.eaId) & 0xffffff : 0;
      if (!eaId) {
        try {
          eaId = await resolveTargetEaId(player);
        } catch (error) {
          warnOnce(
            'target-ea-id-lookup',
            '[FutRUSH:targets]',
            'Oyuncunun EA kimliği çözülemedi; FutBIN fiyatı kullanılacak.',
            error
          );
        }
      }
      if (eaId > 0 && !token.cancelled && !state.botRunning) {
        player.eaId = eaId;
        didEaSearch = true;
        try {
          const options = {
            eaId,
            rating: player.rating,
            reference,
            token,
            maxSearches: settings.maxSearches,
            gapMs: settings.searchGapMs,
            outlierRatio: settings.outlierRatio
          };
          if (sleepFn) options.sleepFn = sleepFn;
          const result = await getMarketPrice((maxBuy) => fetchPage(eaId, maxBuy), options);
          if (!token.cancelled) {
            if (result.ok) {
              consecutiveErrors = 0;
              if (result.price) {
                player.price = result.price;
                player.buyNow = result.price;
                usedEaPrice = true;
              }
              if (result.skipped && result.skipped.length) {
                info('EA fiyatı hesaplanırken aykırı ilanlar atlandı:', player.name, result.skipped);
              }
            } else {
              consecutiveErrors++;
              if (consecutiveErrors >= settings.maxConsecutiveErrors) {
                stopEaSearch = true;
                warnOnce(
                  'target-ea-price-consecutive-errors',
                  '[FutRUSH:targets]',
                  'Art arda EA fiyat araması başarısız oldu; kalan oyuncularda FutBIN fiyatı kullanılacak.',
                  result.error
                );
              }
            }
          }
        } catch (error) {
          consecutiveErrors++;
          if (consecutiveErrors >= settings.maxConsecutiveErrors) {
            stopEaSearch = true;
            warnOnce(
              'target-ea-price-consecutive-errors',
              '[FutRUSH:targets]',
              'Art arda EA fiyat araması başarısız oldu; kalan oyuncularda FutBIN fiyatı kullanılacak.',
              error
            );
          }
        }
      }
    }

    if (!usedEaPrice) {
      player.price = reference;
      player.buyNow = reference;
      fallbackCount++;
    }
    added += mergeTargetPlayers([player]);
    emit('targets:changed');

    if (didEaSearch && index < players.length - 1 && !token.cancelled) {
      await actionGap(token, settings.actionGapMs);
    }
  }
  return { added, fallbackCount, total: players.length, fallback };
}

export async function importCheapestTargets(rating, count, deps = {}) {
  if (activeToken) activeToken.cancel();
  const token = createCancelToken();
  activeToken = token;
  const loadPlayers = deps.fetchCheapestPlayers || fetchCheapestPlayers;
  const fetchPage = deps.fetchMarketPage || fetchMarketPage;
  const sleepFn = deps.sleepFn;
  state.targetLoading = true;
  state.targetStatus = null;
  emit('targets:changed');
  try {
    const result = await loadPlayers(rating, count);
    if (CONFIG.targetAdd.priceSource !== 'ea') {
      const added = mergeTargetPlayers(result.players);
      const fallbackNote = result.fallback ? ' (FutBIN yedek kaynağı)' : '';
      state.targetStatus = {
        type: 'success',
        message: added ? added + ' oyuncu hedef listesine eklendi' + fallbackNote + '.' : 'Bulunan oyuncular zaten hedef listesinde.'
      };
      return;
    }

    const imported = await importWithEaPrices(result.players, result.fallback, token, fetchPage, sleepFn);
    if (activeToken === token) {
      state.targetStatus = { type: 'success', message: importStatus(imported.added, imported.fallback, imported.fallbackCount, imported.total) };
    }
  } catch (error) {
    if (activeToken === token) {
      state.targetStatus = { type: 'error', message: error.message || 'FutBIN oyuncuları yüklenemedi.' };
      if (error.blocked) console.error('[FutRUSH] FutBIN engelleme ayrıntısı:', error);
    }
  } finally {
    if (activeToken === token) {
      state.targetLoading = false;
      emit('targets:changed');
    }
  }
}
