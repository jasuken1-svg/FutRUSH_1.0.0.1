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
import { checkPilesProtection } from '../ea/piles.js';
import { checkPriceCapGuard } from '../ea/priceCapGuard.js';
import { computeEffectiveBuyNow, recordEscalationSearch, resetEscalationOnPurchase } from '../ea/escalation.js';
import { hasCurrentTargetEaId, resolveTargetEaId } from '../targets/targetOps.js';
import { addBotLog, setBotStatus } from './botLog.js';
import { addMarketLog } from '../ui/marketLogBox.js';
import { idleWait } from './idle.js';
import { safetyGovernor } from './safetyGovernor.js';
import { getEffectiveSpeedDelayMs, SPEED_TIERS } from './speedTiers.js';

const defaultSearchJitterMs = [...CONFIG.bot.searchJitterMs];
const defaultCycleJitterMs = [...CONFIG.bot.cycleJitterMs];

export function stopAutoBuyer(reason) {
  if (!state.botRunning) return;
  state.botRunning = false;
  state.botToken++;
  state.botWait = null;
  emit('bot:wait');
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
  const getSpeedDelay = () => getEffectiveSpeedDelayMs(state.snipeSettings);
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
  let totalProfit = 0;
  let searchIndex = 0;
  const governor = deps.safetyGovernor || safetyGovernor;
  const attemptedTrades = new Set();
  const loggedMatches = new Set();
  const newlyResolvedTargets = new Set();

  const checkLimitsReached = (nextCost = 0) => {
    if (!checkPilesProtection(governor)) return true;
    const check = governor.canSearch({ currentSpent: totalSpent, currentBought: bought, nextCost });
    return !check.allowed;
  };

  try {
    for (const target of state.targets) {
      if (target.searchDisabled || target.insufficientBalance) continue;
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
        if (target.searchDisabled || target.insufficientBalance) continue;

        // Tavan Fiyat Kontrolü: Hedefin Buy Now değeri FutBIN tavanını aşıyorsa botu durdur
        if (!checkPriceCapGuard(target, target.buyNow)) {
          stopAutoBuyer(`Fiyat koruması: ${target.name} (Buy Now: ${Number(target.buyNow).toLocaleString('tr-TR')} > FutBIN: ${Number(target.price).toLocaleString('tr-TR')})`);
          return;
        }

        const effectiveCalc = computeEffectiveBuyNow(target, { maxPriceCapThreshold: state.snipeSettings?.maxPriceCapThreshold });
        const currentSearchBuyNow = effectiveCalc.effectiveBuyNow;
        if (!checkPriceCapGuard(target, currentSearchBuyNow)) {
          stopAutoBuyer('Fiyat koruması: ' + target.name + ' efektif SATIN AL (' + currentSearchBuyNow.toLocaleString('tr-TR') + ') FutBIN tavanını aşıyor!');
          return;
        }

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
          const searchStartTime = Date.now();
          const result = await search(target, eaId, token, { searchIndex, effectiveBuyNow: currentSearchBuyNow });
          const searchEndTime = Date.now();
          const now = searchEndTime;
          const searchDurationMs = searchEndTime - searchStartTime;
          const elapsedMs = (typeof target._lastSearchActiveAt === 'number' && target._lastSearchActiveAt > 0 && (now - target._lastSearchActiveAt <= 30000))
            ? (now - target._lastSearchActiveAt)
            : searchDurationMs;
          target._lastSearchActiveAt = now;
          if (result.stopped) return;
          const offer = result.offers.find((item) => !attemptedTrades.has(item.tradeId));
          if (!offer) {
            governor.recordResult(200);
            addBotLog(target.name + ': Satın Al sınırında uygun ilan bulunamadı.', 'info');
            const escRecord = recordEscalationSearch(target, { matchFound: false, elapsedMs, canProgress: true }, { maxPriceCapThreshold: state.snipeSettings?.maxPriceCapThreshold });
            if (escRecord.logMessage) {
              addMarketLog({ text: '📈 [Otomatik Arttırma] ' + escRecord.logMessage, type: escRecord.steppedUp ? 'info' : 'warn' });
              emit('targets:changed');
            }
          } else {
            recordEscalationSearch(target, { matchFound: true, elapsedMs, canProgress: true });
            attemptedTrades.add(offer.tradeId);
            if (checkLimitsReached(offer.price)) return;
            if (!checkPilesProtection(governor)) return;
            if (!checkPriceCapGuard(target, offer.price)) {
              stopAutoBuyer(`Fiyat koruması: ${target.name} teklif fiyatı FutBIN referansını aşıyor (${offer.price.toLocaleString('tr-TR')})`);
              return;
            }
            const balance = coinBalance();
            if (balance != null && offer.price > balance) {
              addMarketLog({
                text: `${target.name}: Satın alma atlandı — Bakiye yetersiz (${balance.toLocaleString('tr-TR')} < ${offer.price.toLocaleString('tr-TR')}).`,
                type: 'warn'
              });
              continue;
            }

            if (state.snipeSettings.dryRun) {
              resetEscalationOnPurchase(target);
              addMarketLog({ text: '🎯 [Otomatik Arttırma - Kuru Çalıştırma] ' + target.name + ' simüle alındı, fiyat adımları sıfırlandı.', type: 'info' });
              emit('targets:changed');
              governor.recordPurchase(offer.price);
              incrementStat('simulatedBought');
              addBotLog({
                name: target.name,
                rating: offer.rating,
                price: offer.price,
                kind: 'dryRun'
              });
              setBotStatus('KURU ÇALIŞTIRMA: ' + target.name + ' ' + offer.price.toLocaleString('tr-TR') + ' fiyatından alınırdı');
            } else {
              setBotStatus(target.name + ' · ' + offer.price.toLocaleString('tr-TR') + ' coin için satın alma deneniyor...');
              let purchase;
              try {
                purchase = await buy(offer);
              } catch (error) {
                purchase = { success: false, error };
              }
              if (token !== state.botToken || !state.botRunning) return;
              if (purchase.success) {
                resetEscalationOnPurchase(target);
                addMarketLog({ text: '🎯 [Otomatik Arttırma] ' + target.name + ' satın alındı, fiyat adımları sıfırlandı.', type: 'success' });
                emit('targets:changed');
                bought++;
                totalSpent += offer.price;
                incrementStat('bought');
                governor.recordPurchase(offer.price);
                const futbinPrice = Number(target.price) || 0;
                const cardProfit = futbinPrice > 0 ? Math.round(futbinPrice * 0.95) - offer.price : 0;
                totalProfit += cardProfit;
                addBotLog({
                  name: target.name,
                  rating: offer.rating,
                  price: offer.price,
                  profit: cardProfit,
                  totalProfit,
                  kind: 'success'
                });
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
                if (classified.code === 458 || String(classified.code) === '458') {
                  governor.halt('captcha');
                  return;
                }
                if (classified.kind === 'fatal' && CONFIG.bot.stopOnFatalPurchaseError) {
                  stopAutoBuyer('Kritik EA satın alma hatası nedeniyle tarama durduruldu.');
                }
              }
            }
          }
          const hasMoreSearches = attempt < attempts || state.targets.slice(targetIndex + 1).some((t) => !t.searchDisabled && !t.insufficientBalance);
          if (checkLimitsReached()) return;
          if (hasMoreSearches && state.botRunning && token === state.botToken) {
            const baseDelay = getSpeedDelay();
            const jitter = jitterMs(searchJitterRange);
            const totalDelay = baseDelay + jitter;
            debug('[FutRUSH:bot]', 'Arama arası gecikme:', totalDelay, 'ms (taban ' + baseDelay + ' + jitter ' + jitter + ')');
            const activeTier = SPEED_TIERS[state.snipeSettings?.speed] || SPEED_TIERS[1];
            state.botWait = {
              baseMs: baseDelay,
              jitterMs: jitter,
              totalMs: totalDelay,
              duration: totalDelay,
              tierColor: activeTier.color,
              tierRgb: activeTier.rgb || '56, 189, 248'
            };
            if (state.botLogs[0] && state.botLogs[0].message?.includes('uygun ilan bulunamadı')) {
              state.botLogs[0].baseMs = baseDelay;
              state.botLogs[0].jitterMs = jitter;
              state.botLogs[0].totalMs = totalDelay;
            }
            await idle(totalDelay, token, 'search');
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
          baseDelay = getSpeedDelay();
        }
      } else if (typeof waitCfg === 'number' && waitCfg > 0) {
        baseDelay = waitCfg * 1000;
      } else {
        baseDelay = getSpeedDelay();
      }
      const jitter = jitterMs(cycleJitterRange);
      const totalDelay = baseDelay + jitter;
      debug('[FutRUSH:bot]', 'Döngü sonu gecikme:', totalDelay, 'ms (taban ' + baseDelay + ' + jitter ' + jitter + ')');
      const activeTier = SPEED_TIERS[state.snipeSettings?.speed] || SPEED_TIERS[1];
      state.botWait = {
        baseMs: baseDelay,
        jitterMs: jitter,
        totalMs: totalDelay,
        duration: totalDelay,
        tierColor: activeTier.color,
        tierRgb: activeTier.rgb || '56, 189, 248'
      };
      if (state.botLogs[0] && state.botLogs[0].message?.includes('uygun ilan bulunamadı')) {
        state.botLogs[0].baseMs = baseDelay;
        state.botLogs[0].jitterMs = jitter;
        state.botLogs[0].totalMs = totalDelay;
      }
      await idle(totalDelay, token, 'cycle');
    } while (state.botRunning && token === state.botToken);
  } catch (error) {
    if (token === state.botToken) {
      const code = error?.status || error?.code;
      if (code === 458 || String(code) === '458') {
        governor.halt('captcha');
      } else {
        governor.recordResult(code || 500);
        incrementStat('errors');
        state.botRunning = false;
        state.botToken++;
        setBotStatus(error.message || 'FutRUSH taraması hata nedeniyle durdu.');
        addBotLog(state.botStatus, 'error');
      }
    }
  }
}
