// Transfer Market alımlarını yönetir; EA pazar servisleri, hedefler ve bot durumunu kullanır.
// Bağımlılıklar: ea/market, ea/services, targets/targetOps ve bot/botLog.

import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { emit } from '../core/events.js';
import { debug, warnOnce } from '../core/logger.js';
import { pageWindow } from '../utils/dom.js';
import { wait } from '../utils/async.js';
import { randomBetween } from '../utils/cancelToken.js';
import { searchAutoBuyOffers, buyAutoOffer } from '../ea/market.js';
import { classifyPurchaseError } from '../ea/errorCodes.js';
import { getCoinBalance } from '../ea/services.js';
import { hasCurrentTargetEaId, resolveTargetEaId } from '../targets/targetOps.js';
import { addBotLog, setBotStatus } from './botLog.js';
import { idleWait } from './idle.js';
import { safetyGovernor } from './safetyGovernor.js';

const defaultSearchJitterMs = [...CONFIG.bot.searchJitterMs];
const defaultCycleJitterMs = [...CONFIG.bot.cycleJitterMs];

export function stopAutoBuyer(reason) {
  if (!state.botRunning) return;
  state.botRunning = false;
  state.botToken++;
  setBotStatus(reason || 'Tarama durduruldu.');
  addBotLog(state.botStatus, 'error');
}

export async function startAutoBuyer() {
  if (state.botRunning) return;
  if (safetyGovernor.isHalted()) {
    setBotStatus('Güvenlik durdurucu devrede: ' + safetyGovernor.getHaltReason());
    addBotLog('⛔ Bot başlatılamadı: ' + safetyGovernor.getHaltReason() + ' (Devam etmek için "Devam Et" butonuna basın).', 'error');
    return;
  }
  if (!state.targets.length) {
    setBotStatus('Önce Oyuncu Hedefleri listesine oyuncu ekleyin.');
    addBotLog(state.botStatus, 'error');
    return;
  }
  const service = pageWindow.services?.Item;
  if (!service || typeof service.searchTransferMarket !== 'function' || typeof service.bid !== 'function') {
    setBotStatus('EA Transfer Market hazır değil. Transfer ekranını açıp tekrar deneyin.');
    addBotLog(state.botStatus, 'error');
    return;
  }
  state.botRunning = true;
  const token = ++state.botToken;
  state.botStats = { bought: 0, missed: 0, searches: 0, errors: 0 };
  state.botWait = null;
  emit('bot:stats');
  setBotStatus('Oyuncular eşleştiriliyor...');
  addBotLog('FutRUSH taraması başlatıldı.', 'success');
  runAutoBuyer(token);
}

export async function runAutoBuyer(token, deps = {}) {
  const speedDelay = { 0: 5000, 1: 4000, 2: 2500, 3: 1500 };
  const settings = state.snipeSettings;
  const search = deps.searchAutoBuyOffers || searchAutoBuyOffers;
  const buy = deps.buyAutoOffer || buyAutoOffer;
  const idle = deps.idleWait || idleWait;
  const resolveId = deps.resolveTargetEaId || resolveTargetEaId;
  const coinBalance = deps.getCoinBalance || getCoinBalance;
  const rnd = deps.random || Math.random;
  const validJitterRange = (range, fallback) => (
    Array.isArray(range) &&
    range.length === 2 &&
    range.every(Number.isFinite) &&
    range[0] >= 0 &&
    range[1] >= range[0]
      ? range
      : fallback
  );
  const searchJitterRange = validJitterRange(CONFIG.bot.searchJitterMs, defaultSearchJitterMs);
  const cycleJitterRange = validJitterRange(CONFIG.bot.cycleJitterMs, defaultCycleJitterMs);
  const jitterMs = (range) => Math.round(randomBetween(range[0], range[1], rnd));
  const incrementStat = (name) => {
    state.botStats[name]++;
    emit('bot:stats');
  };
  let cycles = 0;
  let bought = 0;
  let totalSpent = 0;
  let searchIndex = 0;
  const governor = deps.safetyGovernor || safetyGovernor;
  const attemptedTrades = new Set();
  const loggedMatches = new Set();
  const newlyResolvedTargets = new Set();

  const checkLimitsReached = (nextCost = 0) => {
    const check = governor.canSearch({ currentSpent: totalSpent, currentBought: bought, nextCost });
    return !check.allowed;
  };

  try {
    for (const target of state.targets) {
      if (target.searchDisabled) continue;
      if (token !== state.botToken || !state.botRunning) return;
      const needsResolution = !hasCurrentTargetEaId(target);
      await resolveId(target);
      if (token !== state.botToken || !state.botRunning) return;
      if (needsResolution && hasCurrentTargetEaId(target)) newlyResolvedTargets.add(target);
      await wait(250);
    }

    do {
      cycles++;
      for (let targetIndex = 0; targetIndex < state.targets.length; targetIndex++) {
        const target = state.targets[targetIndex];
        if (target.searchDisabled) continue;
        const eaId = Number(target.eaId) || 0;
        const attempts = Math.max(1, Math.round(Number(target.searches) || 1));
        for (let attempt = 1; attempt <= attempts; attempt++) {
          if (token !== state.botToken || !state.botRunning) return;
          if (checkLimitsReached()) return;
          setBotStatus(target.name + ' aranıyor (' + attempt + '/' + attempts + ') · en fazla ' + Number(target.buyNow).toLocaleString('tr-TR'));
          incrementStat('searches');
          if (newlyResolvedTargets.has(target) && !loggedMatches.has(target)) {
            addBotLog(target.name + ' EA oyuncu kimliğiyle eşleştirildi.', 'success');
            loggedMatches.add(target);
          }
          searchIndex++;
          governor.recordSearch();
          const result = await search(target, eaId, token, { searchIndex });
          if (result.stopped) return;
          const offer = result.offers.find((item) => !attemptedTrades.has(item.tradeId));
          if (!offer) {
            governor.recordResult(200);
            addBotLog(target.name + ': Buy Now sınırında uygun ilan bulunamadı.', 'info');
          } else {
            attemptedTrades.add(offer.tradeId);
            if (checkLimitsReached(offer.price)) return;
            const balance = coinBalance();
            if (balance && offer.price > balance) {
              throw new Error('Mevcut coin bakiyesi ilan fiyatından düşük (' + offer.price.toLocaleString('tr-TR') + ').');
            }
            setBotStatus(target.name + ' · ' + offer.price.toLocaleString('tr-TR') + ' coin için satın alma deneniyor...');
            let purchase;
            try {
              purchase = await buy(offer);
            } catch (error) {
              purchase = { success: false, error };
            }
            if (token !== state.botToken || !state.botRunning) return;
            if (purchase.success) {
              bought++;
              totalSpent += offer.price;
              incrementStat('bought');
              governor.recordPurchase(offer.price);
              addBotLog({ name: target.name, rating: offer.rating, price: offer.price, kind: 'success' });
            } else {
              const error = purchase.error;
              const classified = classifyPurchaseError(error, purchase);
              governor.recordResult(classified.code || (classified.kind === 'fatal' ? 500 : 0));
              let rawError;
              try {
                rawError = JSON.stringify(error ?? purchase);
              } catch (serializationError) {
                rawError = String(error?.message || error?.code || 'JSON biçimine dönüştürülemeyen EA hata nesnesi');
              }
              debug('[FutRUSH:bot]', 'Satın alma başarısız; ham EA hatası:', (rawError || String(error || purchase)).slice(0, 300));
              incrementStat(classified.kind === 'missed' ? 'missed' : 'errors');
              if (classified.kind === 'other') {
                warnOnce('purchase-error-other', '[FutRUSH:bot]', 'Sınıflandırılmamış EA satın alma hatası:', (rawError || classified.text).slice(0, 300));
              }
              const codeText = classified.code === null ? '' : ' (kod ' + classified.code + ')';
              if (classified.kind === 'missed') {
                addBotLog({ name: target.name, rating: offer.rating, price: offer.price, kind: 'missed' });
              } else {
                addBotLog(target.name + ': satın alma başarısız — ' + classified.text + codeText, 'error');
              }
              if (classified.kind === 'fatal' && CONFIG.bot.stopOnFatalPurchaseError) {
                stopAutoBuyer('Kritik EA satın alma hatası nedeniyle tarama durduruldu.');
              }
            }
          }
          const hasMoreSearches = attempt < attempts || state.targets.slice(targetIndex + 1).some((t) => !t.searchDisabled);
          if (checkLimitsReached()) return;
          if (hasMoreSearches && state.botRunning && token === state.botToken) {
            const baseDelay = speedDelay[settings.speed] || 4000;
            const jitter = jitterMs(searchJitterRange);
            const totalDelay = baseDelay + jitter;
            debug('[FutRUSH:bot]', 'Arama arası gecikme:', totalDelay, 'ms (taban ' + baseDelay + ' + jitter ' + jitter + ')');
            await idle(baseDelay + jitter, token, 'search');
          }
        }
        if (checkLimitsReached()) break;
      }
      if (!state.botRunning || token !== state.botToken) return;
      if (checkLimitsReached()) return;
      if (settings.repeat > 0 && cycles >= settings.repeat) {
        stopAutoBuyer('Tarama tamamlandı. Başarılı alım: ' + bought + '.');
        return;
      }
      let baseDelay = 4000;
      const waitCfg = settings.waitSeconds;
      if (Array.isArray(waitCfg) && waitCfg.length === 2) {
        const minSec = Math.max(0, Math.min(Number(waitCfg[0]) || 0, Number(waitCfg[1]) || 0));
        const maxSec = Math.max(0, Math.max(Number(waitCfg[0]) || 0, Number(waitCfg[1]) || 0));
        if (maxSec > 0) {
          const chosenSec = Math.round(randomBetween(minSec, maxSec, rnd));
          baseDelay = chosenSec * 1000;
        } else {
          baseDelay = speedDelay[settings.speed] || 4000;
        }
      } else if (typeof waitCfg === 'number' && waitCfg > 0) {
        baseDelay = waitCfg * 1000;
      } else {
        baseDelay = speedDelay[settings.speed] || 4000;
      }
      const jitter = jitterMs(cycleJitterRange);
      const totalDelay = baseDelay + jitter;
      debug('[FutRUSH:bot]', 'Döngü sonu gecikme:', totalDelay, 'ms (taban ' + baseDelay + ' + jitter ' + jitter + ')');
      await idle(totalDelay, token, 'cycle');
    } while (state.botRunning && token === state.botToken);
  } catch (error) {
    if (token === state.botToken) {
      governor.recordResult(error?.status || error?.code || 500);
      incrementStat('errors');
      state.botRunning = false;
      state.botToken++;
      setBotStatus(error.message || 'FutRUSH taraması hata nedeniyle durdu.');
      addBotLog(state.botStatus, 'error');
    }
  }
}
