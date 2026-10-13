import { state } from '../core/state.js';
import { pageWindow } from '../utils/dom.js';
import { wait } from '../utils/async.js';
import { searchAutoBuyOffers, buyAutoOffer } from '../ea/market.js';
import { getCoinBalance } from '../ea/services.js';
import { resolveTargetEaId } from '../targets/targetOps.js';
import { addBotLog, setBotStatus } from './botLog.js';

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
  setBotStatus('Oyuncular eşleştiriliyor...');
  addBotLog('FutRUSH taraması başlatıldı.', 'info');
  runAutoBuyer(token);
}

export async function runAutoBuyer(token) {
  const speedDelay = { 0: 5000, 1: 4000, 2: 2500, 3: 1500 };
  const settings = state.snipeSettings;
  let cycles = 0;
  let bought = 0;
  const attemptedTrades = new Set();
  try {
    for (const target of state.targets) {
      if (token !== state.botToken || !state.botRunning) return;
      await resolveTargetEaId(target);
      if (token !== state.botToken || !state.botRunning) return;
      addBotLog(target.name + ' EA oyuncu kimliğiyle eşleştirildi.', 'success');
      await wait(250);
    }

    do {
      cycles++;
      for (const target of state.targets) {
        const eaId = Number(target.eaId) || 0;
        const attempts = Math.max(1, Math.round(Number(target.searches) || 1));
        for (let attempt = 1; attempt <= attempts; attempt++) {
          if (token !== state.botToken || !state.botRunning) return;
          if (bought >= settings.maxPlayers) {
            stopAutoBuyer('Alım limiti doldu: ' + bought + ' oyuncu.');
            return;
          }
          setBotStatus(target.name + ' aranıyor (' + attempt + '/' + attempts + ') · en fazla ' + Number(target.buyNow).toLocaleString('tr-TR'));
          const result = await searchAutoBuyOffers(target, eaId, token);
          if (result.stopped) return;
          const offer = result.offers.find((item) => !attemptedTrades.has(item.tradeId));
          if (!offer) {
            addBotLog(target.name + ': Buy Now sınırında uygun ilan bulunamadı.', 'info');
          } else {
            attemptedTrades.add(offer.tradeId);
            const balance = getCoinBalance();
            if (balance && offer.price > balance) {
              throw new Error('Mevcut coin bakiyesi ilan fiyatından düşük (' + offer.price.toLocaleString('tr-TR') + ').');
            }
            setBotStatus(target.name + ' · ' + offer.price.toLocaleString('tr-TR') + ' coin için satın alma deneniyor...');
            const purchase = await buyAutoOffer(offer);
            if (token !== state.botToken || !state.botRunning) return;
            if (purchase.success) {
              bought++;
              addBotLog(target.name + ' (' + offer.rating + ') ' + offer.price.toLocaleString('tr-TR') + ' coin karşılığında alındı.', 'success');
            } else {
              const error = purchase.error?.message || purchase.error || 'İlan alınamadı; ilan süresi dolmuş olabilir.';
              addBotLog(target.name + ': satın alma başarısız — ' + error, 'error');
            }
          }
          if (attempt < attempts && state.botRunning) await wait(speedDelay[settings.speed] || 4000);
        }
        if (bought >= settings.maxPlayers) break;
      }
      if (bought >= settings.maxPlayers) {
        stopAutoBuyer('Alım limiti doldu: ' + bought + ' oyuncu.');
        return;
      }
      if (settings.repeat > 0 && cycles >= settings.repeat) {
        stopAutoBuyer('Tarama tamamlandı. Başarılı alım: ' + bought + '.');
        return;
      }
      if (settings.waitSeconds > 0) await wait(settings.waitSeconds * 1000);
      else await wait(speedDelay[settings.speed] || 4000);
    } while (state.botRunning && token === state.botToken);
  } catch (error) {
    if (token === state.botToken) {
      state.botRunning = false;
      state.botToken++;
      setBotStatus(error.message || 'FutRUSH taraması hata nedeniyle durdu.');
      addBotLog(state.botStatus, 'error');
    }
  }
}
