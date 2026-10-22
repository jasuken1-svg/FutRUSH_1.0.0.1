// Güvenlik Yöneticisi (SafetyGovernor):
// Saatlik arama, günlük arama, ardışık 429/500 hata ve satın alma/harcama limitlerini denetler.
// Bagimliliklar: core/state, core/events, core/storage, bot/botLog.

import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { pageStorage } from '../core/storage.js';
import { addBotLog, setBotStatus } from './botLog.js';

const GOVERNOR_STORAGE_KEY = 'futrush-safety-governor';
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function safeStorage() {
  try {
    if (typeof pageStorage === 'function') {
      const s = pageStorage();
      if (s && typeof s.getItem === 'function') return s;
    }
  } catch {}
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
}

export class SafetyGovernor {
  constructor(deps = {}) {
    this.storage = deps.storage || safeStorage;
    this.searches = [];
    this.consecutiveErrors = 0;
    this.halted = false;
    this.haltReason = null;
    this.captchaHalted = false;
    this.load();
  }

  load() {
    try {
      const raw = this.storage()?.getItem(GOVERNOR_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.searches)) {
          const now = Date.now();
          this.searches = data.searches.filter((t) => typeof t === 'number' && t >= now - ONE_DAY_MS);
        }
        if (typeof data.consecutiveErrors === 'number') {
          this.consecutiveErrors = data.consecutiveErrors;
        }
        if (typeof data.halted === 'boolean') {
          this.halted = data.halted;
          this.haltReason = data.haltReason || null;
        }
        if (typeof data.captchaHalted === 'boolean') {
          this.captchaHalted = data.captchaHalted;
        }
      }
    } catch {
      this.searches = [];
      this.consecutiveErrors = 0;
      this.halted = false;
      this.haltReason = null;
      this.captchaHalted = false;
    }
  }

  save() {
    try {
      this.pruneOldSearches();
      const payload = {
        searches: this.searches,
        consecutiveErrors: this.consecutiveErrors,
        halted: this.halted,
        haltReason: this.haltReason,
        captchaHalted: this.captchaHalted
      };
      this.storage()?.setItem(GOVERNOR_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage hatasinda sessizce devam et
    }
  }

  pruneOldSearches() {
    const cutoff = Date.now() - ONE_DAY_MS;
    this.searches = this.searches.filter((t) => t >= cutoff);
  }

  canSearch(context = {}) {
    if (this.isHalted()) {
      return { allowed: false, reason: this.getHaltReason() };
    }

    const now = Date.now();
    this.pruneOldSearches();

    const hourlyLimit = Number(state.snipeSettings?.hourlySearchLimit) || 0;
    if (hourlyLimit > 0) {
      const hourlyCount = this.searches.filter((t) => t >= now - ONE_HOUR_MS).length;
      if (hourlyCount >= hourlyLimit) {
        const reason = `Saatlik arama limiti doldu (${hourlyCount}/${hourlyLimit}).`;
        this.halt(reason);
        return { allowed: false, reason };
      }
    }

    const dailyLimit = Number(state.snipeSettings?.dailySearchLimit) || 0;
    if (dailyLimit > 0) {
      const dailyCount = this.searches.filter((t) => t >= now - ONE_DAY_MS).length;
      if (dailyCount >= dailyLimit) {
        const reason = `Günlük arama limiti doldu (${dailyCount}/${dailyLimit}).`;
        this.halt(reason);
        return { allowed: false, reason };
      }
    }

    const currentBought = Number(context.currentBought) || 0;
    const maxPlayers = Number(state.snipeSettings?.maxPlayers) || 0;
    if (maxPlayers > 0 && currentBought >= maxPlayers) {
      const reason = 'Alım limiti doldu: ' + currentBought + ' oyuncu.';
      this.halt(reason);
      return { allowed: false, reason };
    }

    const currentSpent = Number(context.currentSpent) || 0;
    const nextCost = Number(context.nextCost) || 0;
    const maxSpendCoins = Number(state.snipeSettings?.maxSpendCoins) || 0;
    if (maxSpendCoins > 0) {
      if (currentSpent >= maxSpendCoins) {
        const reason = 'Harcama limiti doldu: ' + currentSpent.toLocaleString('tr-TR') + ' coin.';
        this.halt(reason);
        return { allowed: false, reason };
      }
      if (nextCost > 0 && currentSpent + nextCost > maxSpendCoins) {
        const reason = 'Harcama limiti aşılacak: ' + (currentSpent + nextCost).toLocaleString('tr-TR') + ' > ' + maxSpendCoins.toLocaleString('tr-TR') + ' coin.';
        this.halt(reason);
        return { allowed: false, reason };
      }
    }

    return { allowed: true };
  }

  recordSearch() {
    this.searches.push(Date.now());
    this.save();
    emit('governor:update', this.getStats());
  }

  recordResult(statusCode) {
    const code = Number(statusCode);
    const isError = code === 429 || code === 500 || code === 502 || code === 503 || code === 520 || (code >= 500 && code < 600);
    if (isError) {
      this.consecutiveErrors++;
      const limit = Math.max(1, Number(state.snipeSettings?.consecutiveErrorLimit) || 3);
      if (this.consecutiveErrors >= limit) {
        const reason = `Ardışık ${this.consecutiveErrors} EA sunucu hatası (${statusCode}) alındı. Güvenlik için durduruldu.`;
        this.halt(reason);
      } else {
        this.save();
      }
    } else if (code === 200 || (code >= 200 && code < 300)) {
      if (this.consecutiveErrors > 0) {
        this.consecutiveErrors = 0;
        this.save();
      }
    }
  }

  recordPurchase(price = 0) {
    this.recordResult(200);
    this.save();
    emit('governor:update', this.getStats());
  }

  halt(reason) {
    const isCaptcha = reason === 'captcha' || (typeof reason === 'string' && reason.toLowerCase() === 'captcha');
    this.halted = true;
    this.captchaHalted = isCaptcha;
    this.haltReason = isCaptcha ? 'captcha' : (reason || 'Güvenlik durdurucu devrede.');
    this.save();

    if (state.botRunning) {
      state.botRunning = false;
      state.botToken++;
    }
    const statusText = isCaptcha
      ? 'CAPTCHA tespit edildi! Güvenlik durdurucu devrede.'
      : this.haltReason;
    const logText = isCaptcha
      ? '⛔ CAPTCHA tespit edildi! Tüm EA istekleri kilitlendi. Lütfen doğrulamayı çözün.'
      : this.haltReason;
    setBotStatus(statusText);
    addBotLog(logText, 'error');
    emit('governor:halt', { reason: this.haltReason, isCaptcha });
  }

  isHalted() {
    return this.halted === true;
  }

  isCaptchaHalted() {
    return this.halted === true && (this.captchaHalted === true || this.haltReason === 'captcha');
  }

  getHaltReason() {
    return this.haltReason;
  }

  resume() {
    this.halted = false;
    this.haltReason = null;
    this.captchaHalted = false;
    this.consecutiveErrors = 0;
    this.save();
    setBotStatus('Güvenlik durdurucu sıfırlandı.');
    addBotLog('Güvenlik durdurucu sıfırlandı. Taramaya devam edilebilir.', 'success');
    emit('governor:resume');
  }

  getStats() {
    const now = Date.now();
    this.pruneOldSearches();
    const hourlySearches = this.searches.filter((t) => t >= now - ONE_HOUR_MS).length;
    const dailySearches = this.searches.filter((t) => t >= now - ONE_DAY_MS).length;
    return {
      hourlySearches,
      dailySearches,
      hourlyLimit: Number(state.snipeSettings?.hourlySearchLimit) || 0,
      dailyLimit: Number(state.snipeSettings?.dailySearchLimit) || 0,
      consecutiveErrors: this.consecutiveErrors,
      consecutiveErrorLimit: Number(state.snipeSettings?.consecutiveErrorLimit) || 3,
      halted: this.halted,
      captchaHalted: this.captchaHalted,
      haltReason: this.haltReason
    };
  }

  static halt(reason) {
    return safetyGovernor.halt(reason);
  }

  static resume() {
    return safetyGovernor.resume();
  }

  static isHalted() {
    return safetyGovernor.isHalted();
  }

  static isCaptchaHalted() {
    return safetyGovernor.isCaptchaHalted();
  }
}

export const safetyGovernor = new SafetyGovernor();
