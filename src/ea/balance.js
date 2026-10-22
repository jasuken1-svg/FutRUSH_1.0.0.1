// EA FC Web App bakiye (coin) yonetimi ve senkronizasyonu
// Bagimliliklar: utils/dom, ea/priceSteps, core/events, core/state, ui/marketLogBox

import { pageWindow } from '../utils/dom.js';
import { parsePriceInput } from './priceSteps.js';
import { emit, on } from '../core/events.js';
import { state } from '../core/state.js';
import { addMarketLog } from '../ui/marketLogBox.js';

let currentBalance = null;
let observer = null;
const balanceListeners = new Set();
let nullLogged = false;

export function getBalance() {
  // 1. Birincil kaynak: EA servisleri
  try {
    const serviceAmount = pageWindow.services?.User?.getUser?.()?.coins?.amount;
    if (typeof serviceAmount === 'number' && Number.isFinite(serviceAmount)) {
      return serviceAmount;
    }
    if (serviceAmount != null && String(serviceAmount).trim() !== '') {
      const parsed = Number(serviceAmount);
      if (Number.isFinite(parsed)) return parsed;
    }
  } catch {}

  // 2. Ikincil kaynak: Ust bardaki DOM elemani
  if (typeof document !== 'undefined') {
    const coinEl = document.querySelector('.view-navbar-currency-coins, .currency-coins, [class*="currency-coins"], .view-navbar-currency');
    if (coinEl) {
      const text = coinEl.textContent || '';
      const parsed = parsePriceInput(text);
      if (parsed > 0 || text.includes('0')) {
        return parsed;
      }
    }
  }

  // Deger okunamiyorsa null don (tahmin etme, 0 sayma)
  return null;
}

export function applyBalanceProtection(balance) {
  // Bakiye null ise hedefleri pasife ALMA
  if (balance === null) {
    if (!nullLogged) {
      nullLogged = true;
      addMarketLog({ text: 'Bakiye okunamıyor. Hedefler aktif tutuluyor.', type: 'warn' });
    }
    return;
  }

  nullLogged = false;
  let changed = false;

  const targets = Array.isArray(state.targets) ? state.targets : [];
  for (const target of targets) {
    const maxBuy = Number(target.buyNow) || 0;
    const isInsufficient = maxBuy > balance;

    if (isInsufficient && !target.insufficientBalance) {
      target.insufficientBalance = true;
      changed = true;
      addMarketLog({
        text: `${target.name}: Bakiye yetersiz (${balance.toLocaleString('tr-TR')} < ${maxBuy.toLocaleString('tr-TR')}), hedef pasife alındı.`,
        type: 'warn'
      });
    } else if (!isInsufficient && target.insufficientBalance) {
      target.insufficientBalance = false;
      changed = true;
      addMarketLog({
        text: `${target.name}: Bakiye yeterli (${balance.toLocaleString('tr-TR')} >= ${maxBuy.toLocaleString('tr-TR')}), hedef tekrar aktif.`,
        type: 'info'
      });
    }
  }

  if (changed) {
    emit('targets:changed');
  }
}

export function syncBalance() {
  const newBal = getBalance();
  const prevBal = currentBalance;
  const isChanged = newBal !== prevBal;

  currentBalance = newBal;
  state.currentBalance = newBal;

  applyBalanceProtection(newBal);

  if (isChanged) {
    for (const listener of balanceListeners) {
      try {
        listener(newBal, prevBal);
      } catch (err) {
        console.error('[FutRUSH:balance]', err);
      }
    }
    emit('balance:changed', newBal);
  }

  return newBal;
}

export function ensureBalanceObserver() {
  if (observer || typeof document === 'undefined') return;

  const targetNode = document.querySelector('.view-navbar-currency, .ut-navigation-container-view--currency, header') || document.body;
  if (!targetNode) return;

  observer = new MutationObserver(() => {
    syncBalance();
  });

  observer.observe(targetNode, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

export function onBalanceChange(cb) {
  if (typeof cb !== 'function') return () => {};
  balanceListeners.add(cb);
  ensureBalanceObserver();
  return () => {
    balanceListeners.delete(cb);
  };
}

// Hedefler listesi veya fiyati degistiginde bakiye korumasini hemen tekrar calistir
on('targets:changed', () => {
  if (currentBalance !== null) {
    applyBalanceProtection(currentBalance);
  }
});

export function resetBalanceStateForTesting() {
  currentBalance = null;
  nullLogged = false;
  balanceListeners.clear();
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}
