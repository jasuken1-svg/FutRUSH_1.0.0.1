// FutBIN oyuncularini yukler; istege gore EA piyasa fiyatini alip hedeflere ekler.
// Bagimliliklar: core state/events/config, ea pricing, futbin loader ve targets.

import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { CONFIG } from '../core/config.js';
import { info, warnOnce } from '../core/logger.js';
import { getMarketPrice } from '../ea/marketPrice.js';
import { fetchMarketPage } from '../ea/marketPage.js';
import { createCancelToken, randomBetween, sleep } from '../utils/cancelToken.js';
import { fetchCheapestPlayers } from '../futbin/loader.js';
import { applyTargetAddDiscount, mergeTargetPlayers, resolveTargetEaId } from './targetOps.js';
import { setTargetStatus } from './targetStatus.js';

let activeToken = null;

function importStatus(added, fallback, fallbackCount, total) {
  let message = added ? added + ' oyuncu hedef listesine eklendi' : 'Bulunan oyuncular zaten hedef listesinde';
  if (fallback) message += ' (FutBIN yedek kaynağı)';
  if (fallbackCount === 0 && total > 0) message += ' (fiyatlar EA\'dan)';
  else if (fallbackCount > 0 && fallbackCount < total) message += ' (' + fallbackCount + ' oyuncuda FutBIN fiyatı kullanıldı)';
  else if (fallbackCount === total && total > 0) message += ' (' + fallbackCount + ' oyuncuda FutBIN fiyatı kullanıldı)';
  return message + '.';
}

async function importWithEaPrices(players, fallback, token, fetchPage, sleepFn, randomBetweenFn, sleepBetweenFn) {
  let added = 0;
  let fallbackCount = 0;
  let consecutiveErrors = 0;
  let stopEaSearch = false;
  const settings = CONFIG.targetAdd;

  if (activeToken === token) state.targetLoading = false;
  for (let index = 0; index < players.length; index++) {
    if (token.cancelled) break;
    const player = players[index];
    let didEaSearch = false;
    let usedEaPrice = false;
    const reference = player.price;

    if (activeToken === token) {
      setTargetStatus({
        type: 'loading',
        message: 'EA fiyatı alınıyor ' + (index + 1) + '/' + players.length + ': ' + player.name,
        source: 'mixed',
        progress: { done: index, total: players.length }
      });
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

    if (token.cancelled) break;
    if (!usedEaPrice) {
      player.price = reference;
      player.buyNow = reference;
      fallbackCount++;
    }
    const importedPlayer = applyTargetAddDiscount(player, settings.discountRate);
    added += mergeTargetPlayers([importedPlayer]);
    const shouldWait = didEaSearch && index < players.length - 1 && !token.cancelled;
    const gap = shouldWait ? randomBetweenFn(settings.actionGapMs[0], settings.actionGapMs[1]) : 0;
    if (activeToken === token && index < players.length - 1) {
      setTargetStatus({
        type: 'success',
        message: player.name + ' · Buy Now ' + Number(importedPlayer.buyNow).toLocaleString('tr-TR') + ' hedeflere eklendi.',
        source: usedEaPrice ? 'ea' : 'futbin',
        progress: { done: index + 1, total: players.length },
        ...(shouldWait ? { holdMs: gap } : {})
      });
    }
    emit('targets:changed');

    if (shouldWait) await sleepBetweenFn(gap, token);
  }
  if (token.cancelled) return { added, fallbackCount, total: players.length, fallback, cancelled: true };
  return { added, fallbackCount, total: players.length, fallback };
}

export async function importCheapestTargets(rating, count, deps = {}) {
  if (activeToken) activeToken.cancel();
  const token = createCancelToken();
  activeToken = token;
  const loadPlayers = deps.fetchCheapestPlayers || fetchCheapestPlayers;
  const fetchPage = deps.fetchMarketPage || fetchMarketPage;
  const sleepFn = deps.sleepFn;
  const randomBetweenFn = deps.randomBetween || randomBetween;
  const sleepBetweenFn = deps.sleep || sleep;
  state.targetLoading = true;
  setTargetStatus({
    type: 'loading',
    message: 'FutBIN oyuncuları yükleniyor...',
    source: 'futbin',
    progress: { done: 0, total: count }
  });
  emit('targets:changed');
  try {
    const result = await loadPlayers(rating, count);
    if (activeToken !== token || token.cancelled) return;

    if (CONFIG.targetAdd.priceSource !== 'ea') {
      if (!result.players || result.players.length === 0) {
        const added = mergeTargetPlayers([]);
        const fallbackNote = result.fallback ? ' (FutBIN yedek kaynağı)' : '';
        setTargetStatus({
          type: 'success',
          message: added ? added + ' oyuncu hedef listesine eklendi' + fallbackNote + '.' : 'Bulunan oyuncular zaten hedef listesinde.',
          source: 'futbin',
          progress: { done: 0, total: 0 },
          holdMs: CONFIG.ui.statusHoldMs
        });
        return;
      }

      const total = result.players.length;
      let addedTotal = 0;
      for (let i = 0; i < total; i++) {
        if (token.cancelled || activeToken !== token) break;
        const player = result.players[i];
        const importedPlayer = applyTargetAddDiscount(player, CONFIG.targetAdd.discountRate);
        const added = mergeTargetPlayers([importedPlayer]);
        if (typeof added === 'number') addedTotal += added;
        else if (added) addedTotal += 1;

        if (activeToken === token && !token.cancelled) {
          setTargetStatus({
            type: 'loading',
            message: `${player.name} hedeflere eklendi (${i + 1}/${total})...`,
            source: 'futbin',
            progress: { done: i + 1, total }
          });
          emit('targets:changed');
        }

        if (i < total - 1 && !token.cancelled && activeToken === token) {
          const delay = randomBetweenFn(1000, 2000);
          await sleepBetweenFn(delay, token);
        }
      }

      if (activeToken === token && !token.cancelled) {
        const fallbackNote = result.fallback ? ' (FutBIN yedek kaynağı)' : '';
        setTargetStatus({
          type: 'success',
          message: addedTotal ? `${addedTotal} oyuncu hedef listesine eklendi${fallbackNote}.` : 'Bulunan oyuncular zaten hedef listesinde.',
          source: 'futbin',
          progress: { done: total, total },
          holdMs: CONFIG.ui.statusHoldMs
        });
      }
      return;
    }

    const imported = await importWithEaPrices(result.players, result.fallback, token, fetchPage, sleepFn, randomBetweenFn, sleepBetweenFn);
    if (activeToken === token) {
      const source = imported.total === 0 || imported.fallbackCount === imported.total
        ? 'futbin'
        : imported.fallbackCount === 0 ? 'ea' : 'mixed';
      setTargetStatus({
        type: 'success',
        message: importStatus(imported.added, imported.fallback, imported.fallbackCount, imported.total),
        source,
        progress: { done: imported.total, total: imported.total },
        holdMs: CONFIG.ui.statusHoldMs
      });
    }
  } catch (error) {
    if (activeToken === token) {
      setTargetStatus({
        type: 'error',
        message: error.message || 'FutBIN oyuncuları yüklenemedi.',
        source: state.targetStatus?.source || 'futbin',
        progress: state.targetStatus?.progress || { done: 0, total: count }
      });
      if (error.blocked) console.error('[FutRUSH] FutBIN engelleme ayrıntısı:', error);
    }
  } finally {
    if (activeToken === token) {
      state.targetLoading = false;
      emit('targets:changed');
    }
  }
}
