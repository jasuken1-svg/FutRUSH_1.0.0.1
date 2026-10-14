// Transfer Market alımlarını yönetir; EA pazar servisleri, hedefler ve bot durumunu kullanır.
// Bağımlılıklar: ea/market, ea/services, targets/targetOps ve bot/botLog.

import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { emit } from '../core/events.js';
import { debug, warnOnce } from '../core/logger.js';
import { pageWindow } from '../utils/dom.js';
import { wait } from '../utils/async.js';
import { searchAutoBuyOffers, buyAutoOffer } from '../ea/market.js';
import { classifyPurchaseError } from '../ea/errorCodes.js';
import { getCoinBalance } from '../ea/services.js';
import { resolveTargetEaId } from '../targets/targetOps.js';
import { addBotLog, setBotStatus } from './botLog.js';
import { idleWait } from './idle.js';

export function stopAutoBuyer(reason) {
  if (!state.botRunning) return;
  state.botRunning = false;
  state.botToken++;
  setBotStatus(reason || 'Tarama durduruldu.');
  addBotLog(state.botStatus, 'info');
}

export async function startAutoBuyer() {
  if (state.botRunning) return;
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
  addBotLog('FutRUSH taraması başlatıldı.', 'info');
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
  const incrementStat = (name) => {
    state.botStats[name]++;
    emit('bot:stats');
  };
  const delayForSpeed = () => {
    const base = speedDelay[settings.speed] || 4000;
    const jitter = Number(CONFIG.bot.delayJitter) || 0;
    return Math.max(0, Math.round(base * (1 + (Math.random() * 2 - 1) * jitter)));
  };
  let cycles = 0;
  let bought = 0;
  const attemptedTrades = new Set();
  try {
    for (const target of state.targets) {
      if (token !== state.botToken || !state.botRunning) return;
      await resolveId(target);
      if (token !== state.botToken || !state.botRunning) return;
      addBotLog(target.name + ' EA oyuncu kimliğiyle eşleştirildi.', 'success');
      await wait(250);
    }

    do {
      cycles++;
      for (let targetIndex = 0; targetIndex < state.targets.length; targetIndex++) {
        const target = state.targets[targetIndex];
        const eaId = Number(target.eaId) || 0;
        const attempts = Math.max(1, Math.round(Number(target.searches) || 1));
        for (let attempt = 1; attempt <= attempts; attempt++) {
          if (token !== state.botToken || !state.botRunning) return;
          if (bought >= settings.maxPlayers) {
            stopAutoBuyer('Alım limiti doldu: ' + bought + ' oyuncu.');
            return;
          }
          setBotStatus(target.name + ' aranıyor (' + attempt + '/' + attempts + ') · en fazla ' + Number(target.buyNow).toLocaleString('tr-TR'));
          incrementStat('searches');
          const result = await search(target, eaId, token);
          if (result.stopped) return;
          const offer = result.offers.find((item) => !attemptedTrades.has(item.tradeId));
          if (!offer) {
            addBotLog(target.name + ': Buy Now sınırında uygun ilan bulunamadı.', 'info');
          } else {
            attemptedTrades.add(offer.tradeId);
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
              incrementStat('bought');
              addBotLog(target.name + ' (' + offer.rating + ') ' + offer.price.toLocaleString('tr-TR') + ' coin karşılığında alındı.', 'success');
            } else {
              const error = purchase.error;
              const classified = classifyPurchaseError(error, purchase);
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
                addBotLog(target.name + ' (' + offer.rating + '): kaçırıldı — kart başka bir kullanıcı tarafından alınmış (kod ' + (classified.code ?? 'bilinmiyor') + ').', 'missed');
              } else {
                addBotLog(target.name + ': satın alma başarısız — ' + classified.text + codeText, 'error');
              }
              if (classified.kind === 'fatal' && CONFIG.bot.stopOnFatalPurchaseError) {
                stopAutoBuyer('Kritik EA satın alma hatası nedeniyle tarama durduruldu.');
              }
            }
          }
          const hasMoreSearches = attempt < attempts || targetIndex < state.targets.length - 1;
          if (bought >= settings.maxPlayers) {
            stopAutoBuyer('Alım limiti doldu: ' + bought + ' oyuncu.');
            return;
          }
          if (hasMoreSearches && state.botRunning && token === state.botToken) {
            await idle(delayForSpeed(), token, 'search');
          }
        }
        if (bought >= settings.maxPlayers) break;
      }
      if (!state.botRunning || token !== state.botToken) return;
      if (bought >= settings.maxPlayers) {
        stopAutoBuyer('Alım limiti doldu: ' + bought + ' oyuncu.');
        return;
      }
      if (settings.repeat > 0 && cycles >= settings.repeat) {
        stopAutoBuyer('Tarama tamamlandı. Başarılı alım: ' + bought + '.');
        return;
      }
      if (settings.waitSeconds > 0) await idle(settings.waitSeconds * 1000, token, 'cycle');
      else await idle(delayForSpeed(), token, 'cycle');
    } while (state.botRunning && token === state.botToken);
  } catch (error) {
    if (token === state.botToken) {
      incrementStat('errors');
      state.botRunning = false;
      state.botToken++;
      setBotStatus(error.message || 'FutRUSH taraması hata nedeniyle durdu.');
      addBotLog(state.botStatus, 'error');
    }
  }
}
