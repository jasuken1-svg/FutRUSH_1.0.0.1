// Bulunamazsa otomatik fiyat arttırma (Escalation) motoru
// Bağımsız saf fonksiyonlar: priceSteps ve Faz 2 priceCapGuard kuralları ile uyumlu çalışır.

import { priceAbove, roundDownToStep, MIN_BIN } from './priceSteps.js';
import { calculateMaxAllowedPrice, validatePriceCap } from './priceCapGuard.js';

export const MIN_ESCALATION_SECONDS = 15;
export const DEFAULT_ESCALATION_SECONDS = 15;
export const MIN_ESCALATION_MINUTES = 0.25;
export const DEFAULT_ESCALATION_MINUTES = 0.25;
export const MIN_ESCALATION_STEPS = 1;
export const MAX_ESCALATION_STEPS = 10;
export const DEFAULT_MAX_STEPS = 3;
export const PRICE_STALE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/**
 * Hedefin FutBIN referans fiyatının geçerli ve taze olup olmadığını kontrol eder.
 * @param {object} target
 * @param {number} [now]
 * @returns {boolean}
 */
export function isFutbinFreshAndValid(target, now = Date.now()) {
  const futbinPrice = Number(target?.price);
  if (!Number.isFinite(futbinPrice) || futbinPrice <= 0) return false;
  const updatedAt = Number(target?.priceUpdatedAt) || 0;
  if (!updatedAt || (now - updatedAt) > PRICE_STALE_TIMEOUT_MS) return false;
  return true;
}

/**
 * Hedef için efektif SATIN AL fiyatını hesaplar.
 * Temel kural: hedefin buyNow değeri taban kalır; steps kadar priceAbove uygulanır
 * ve şu sınırların EN DÜŞÜĞÜ ile kısıtlanır:
 *  (1) buyNow'dan maxSteps basamak yukarısı
 *  (2) Faz 2 aşırı harcama tavanı (FutBIN * (1 + threshold), roundDownToStep'li)
 *
 * @param {object} target - Hedef nesnesi ({ buyNow, price, escalation })
 * @param {object} [ctx] - Ek bağlam ({ maxPriceCapThreshold, now })
 * @returns {{
 *   effectiveBuyNow: number,
 *   baseBuyNow: number,
 *   stepsApplied: number,
 *   isAtCeiling: boolean,
 *   ceilingReason?: string,
 *   isRiskOfLoss: boolean,
 *   futbinValid: boolean,
 *   maxAllowedCap: number|null
 * }}
 */
export function computeEffectiveBuyNow(target, ctx = {}) {
  const baseBuyNow = Math.max(MIN_BIN, roundDownToStep(Number(target?.buyNow) || MIN_BIN));
  const escalation = target?.escalation;
  const enabled = Boolean(escalation?.enabled);
  const requestedSteps = Math.max(0, Math.floor(Number(escalation?.steps) || 0));
  const maxSteps = Math.max(MIN_ESCALATION_STEPS, Math.min(MAX_ESCALATION_STEPS, Math.floor(Number(escalation?.maxSteps) || DEFAULT_MAX_STEPS)));

  const now = typeof ctx.now === 'number' ? ctx.now : Date.now();
  const futbinValid = isFutbinFreshAndValid(target, now);
  const futbinPrice = Number(target?.price) || 0;

  // FutBIN referansı geçerliyse Faz 2 aşırı harcama tavanını hesapla
  let faz2Cap = null;
  if (futbinValid && futbinPrice > 0) {
    faz2Cap = calculateMaxAllowedPrice(futbinPrice, ctx.maxPriceCapThreshold);
  }

  // Escalation aktif değilse veya adımlar 0 ise
  if (!enabled || requestedSteps === 0) {
    let effective = baseBuyNow;
    let isAtCeiling = false;
    let ceilingReason = null;
    if (faz2Cap !== null && effective > faz2Cap) {
      effective = faz2Cap;
      isAtCeiling = true;
      ceilingReason = 'Faz 2 tavanı aşıldı';
    }
    const isRiskOfLoss = futbinValid && effective > Math.round(futbinPrice * 0.95);
    return {
      effectiveBuyNow: effective,
      baseBuyNow,
      stepsApplied: 0,
      isAtCeiling,
      ceilingReason,
      isRiskOfLoss,
      futbinValid,
      maxAllowedCap: faz2Cap
    };
  }

  // Sınır (1): buyNow üzerine en fazla maxSteps kadar priceAbove
  let maxStepsCap = baseBuyNow;
  for (let i = 0; i < maxSteps; i++) {
    maxStepsCap = priceAbove(maxStepsCap);
  }

  // İstenen adım kadar artırma simülasyonu
  const stepsToApply = Math.min(requestedSteps, maxSteps);
  let currentSteppedPrice = baseBuyNow;
  let actuallyAppliedSteps = 0;

  for (let i = 0; i < stepsToApply; i++) {
    const nextCandidate = priceAbove(currentSteppedPrice);
    // Faz 2 tavan kontrolü: eğer taze FutBIN tavanını aşıyorsa daha fazla artıramayız
    if (faz2Cap !== null && nextCandidate > faz2Cap) {
      break;
    }
    currentSteppedPrice = nextCandidate;
    actuallyAppliedSteps++;
  }

  // Nihai kısıtlama (en düşük olanı al)
  let finalEffective = currentSteppedPrice;
  let isAtCeiling = false;
  let ceilingReason = null;

  if (faz2Cap !== null && finalEffective >= faz2Cap) {
    finalEffective = Math.min(finalEffective, faz2Cap);
    isAtCeiling = true;
    ceilingReason = 'Faz 2 aşırı harcama tavanına ulaşıldı';
  }

  if (actuallyAppliedSteps >= maxSteps || finalEffective >= maxStepsCap) {
    isAtCeiling = true;
    ceilingReason = ceilingReason || `Maksimum basamak sınırına (${maxSteps}) ulaşıldı`;
  }

  // Kâr uyarısı: FutBIN referansı taze ise ve efektif fiyat FutBIN * 0.95'i aşıyorsa
  const isRiskOfLoss = futbinValid && finalEffective > Math.round(futbinPrice * 0.95);

  return {
    effectiveBuyNow: finalEffective,
    baseBuyNow,
    stepsApplied: actuallyAppliedSteps,
    isAtCeiling,
    ceilingReason: isAtCeiling ? ceilingReason : null,
    isRiskOfLoss,
    futbinValid,
    maxAllowedCap: faz2Cap
  };
}

/**
 * Bir arama döngüsü sonrasında hedefin escalation sayacını günceller.
 * @param {object} target - Hedef nesnesi
 * @param {object} outcome - { matchFound: boolean, elapsedMs: number, canProgress: boolean }
 * @param {object} [ctx] - { maxPriceCapThreshold }
 * @returns {{
 *   steppedUp: boolean,
 *   reachedCeiling: boolean,
 *   oldEffective: number,
 *   newEffective: number,
 *   steps: number,
 *   logMessage?: string
 * }}
 */
export function recordEscalationSearch(target, outcome, ctx = {}) {
  const escalation = target?.escalation;
  if (!escalation || !escalation.enabled) {
    return { steppedUp: false, reachedCeiling: false, oldEffective: Number(target?.buyNow) || MIN_BIN, newEffective: Number(target?.buyNow) || MIN_BIN, steps: 0 };
  }

  const beforeCalc = computeEffectiveBuyNow(target, ctx);

  // Eşleşme bulunduysa: activeMs sıfırlanır, adımlar korunur
  if (outcome.matchFound) {
    escalation.activeMs = 0;
    return {
      steppedUp: false,
      reachedCeiling: beforeCalc.isAtCeiling,
      oldEffective: beforeCalc.effectiveBuyNow,
      newEffective: beforeCalc.effectiveBuyNow,
      steps: escalation.steps || 0
    };
  }

  // İlerleme koşulları sağlanmıyorsa (bot durdu, captcha, bakiye yetersiz vb.) activeMs eklenmez
  if (!outcome.canProgress) {
    return {
      steppedUp: false,
      reachedCeiling: beforeCalc.isAtCeiling,
      oldEffective: beforeCalc.effectiveBuyNow,
      newEffective: beforeCalc.effectiveBuyNow,
      steps: escalation.steps || 0
    };
  }

  // Sekme arka planda iken zamanlayıcı sıçramasını önlemek için üst sınır (ör. 15 saniye)
  const safeDeltaMs = Math.max(0, Math.min(Number(outcome.elapsedMs) || 0, 30000));
  escalation.activeMs = (Number(escalation.activeMs) || 0) + safeDeltaMs;

  const afterSeconds = (typeof escalation.afterSeconds === 'number' && Number.isFinite(escalation.afterSeconds))
    ? Math.max(MIN_ESCALATION_SECONDS, Math.floor(escalation.afterSeconds))
    : Math.max(MIN_ESCALATION_SECONDS, Math.floor((Number(escalation.afterMinutes) || 0) * 60) || DEFAULT_ESCALATION_SECONDS);
  const targetDurationMs = afterSeconds * 1000;

  // Süre dolmadıysa henüz artırma yapma
  if (escalation.activeMs < targetDurationMs) {
    return {
      steppedUp: false,
      reachedCeiling: beforeCalc.isAtCeiling,
      oldEffective: beforeCalc.effectiveBuyNow,
      newEffective: beforeCalc.effectiveBuyNow,
      steps: escalation.steps || 0
    };
  }

  // Süre doldu: activeMs sıfırlanır
  escalation.activeMs = 0;

  // FutBIN referansı geçersizse artırma yapılmaz
  if (!beforeCalc.futbinValid) {
    return {
      steppedUp: false,
      reachedCeiling: false,
      oldEffective: beforeCalc.effectiveBuyNow,
      newEffective: beforeCalc.effectiveBuyNow,
      steps: escalation.steps || 0
    };
  }

  const maxSteps = Math.max(MIN_ESCALATION_STEPS, Math.min(MAX_ESCALATION_STEPS, Math.floor(Number(escalation.maxSteps) || DEFAULT_MAX_STEPS)));
  const currentSteps = Math.max(0, Math.floor(Number(escalation.steps) || 0));

  // Tavan kontrolü: adımı 1 artırmayı dene
  const candidateTarget = {
    ...target,
    escalation: { ...escalation, steps: currentSteps + 1 }
  };
  const afterCalc = computeEffectiveBuyNow(candidateTarget, ctx);

  if (currentSteps < maxSteps && afterCalc.effectiveBuyNow > beforeCalc.effectiveBuyNow) {
    escalation.steps = currentSteps + 1;
    escalation.ceilingLogged = false;
    const durationLabel = afterSeconds >= 60 && afterSeconds % 60 === 0
      ? `${afterSeconds / 60} dk`
      : `${afterSeconds} sn`;
    const logMessage = `${target.name}: ${durationLabel} bulunamadı, hedef ${beforeCalc.effectiveBuyNow.toLocaleString('tr-TR')} → ${afterCalc.effectiveBuyNow.toLocaleString('tr-TR')} (+${escalation.steps})`;
    return {
      steppedUp: true,
      reachedCeiling: afterCalc.isAtCeiling,
      oldEffective: beforeCalc.effectiveBuyNow,
      newEffective: afterCalc.effectiveBuyNow,
      steps: escalation.steps,
      logMessage
    };
  }

  // Tavana takıldı
  let logMessage;
  if (!escalation.ceilingLogged) {
    escalation.ceilingLogged = true;
    logMessage = `${target.name}: Fiyat arttırma tavanına ulaştı (${beforeCalc.effectiveBuyNow.toLocaleString('tr-TR')}), daha fazla artırılamaz.`;
  }

  return {
    steppedUp: false,
    reachedCeiling: true,
    oldEffective: beforeCalc.effectiveBuyNow,
    newEffective: beforeCalc.effectiveBuyNow,
    steps: escalation.steps || 0,
    logMessage
  };
}

/**
 * Satın alma gerçekleştikten sonra basamakları ve süreyi sıfırlar.
 * @param {object} target
 */
export function resetEscalationOnPurchase(target) {
  if (target?.escalation) {
    target.escalation.steps = 0;
    target.escalation.activeMs = 0;
    target.escalation.ceilingLogged = false;
  }
}

/**
 * Kullanıcı buyNow değerini değiştirdiğinde veya escalation'ı kapattığında sıfırlar.
 * @param {object} target
 */
export function resetEscalationOnManualChange(target) {
  if (target?.escalation) {
    target.escalation.steps = 0;
    target.escalation.activeMs = 0;
    target.escalation.ceilingLogged = false;
  }
}

/**
 * Konsol testleri: window.__testEscalation()
 * En az 14 senaryoyu doğrular.
 */
export function runEscalationSelfTests() {
  const now = Date.now();
  const testCases = [
    {
      name: 'Duraklatılmışken / canProgress false iken sayaç ilerlememeli',
      fn: () => {
        const t = { name: 'P1', buyNow: 1000, price: 2000, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 10, maxSteps: 3, steps: 0, activeMs: 0 } };
        const res = recordEscalationSearch(t, { matchFound: false, elapsedMs: 5000, canProgress: false }, { now });
        return t.escalation.activeMs === 0 && !res.steppedUp;
      }
    },
    {
      name: 'Süre dolunca (activeMs >= afterMinutes) steps 1 artmalı',
      fn: () => {
        const t = { name: 'P2', buyNow: 1000, price: 3000, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 5, maxSteps: 3, steps: 0, activeMs: 5 * 60 * 1000 - 1000 } };
        const res = recordEscalationSearch(t, { matchFound: false, elapsedMs: 2000, canProgress: true }, { now });
        return res.steppedUp && t.escalation.steps === 1 && t.escalation.activeMs === 0;
      }
    },
    {
      name: 'maxSteps sınırına ulaşılınca daha fazla artmamalı',
      fn: () => {
        const t = { name: 'P3', buyNow: 1000, price: 5000, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 5, maxSteps: 2, steps: 2, activeMs: 5 * 60 * 1000 } };
        const res = recordEscalationSearch(t, { matchFound: false, elapsedMs: 1000, canProgress: true }, { now });
        return !res.steppedUp && res.reachedCeiling && t.escalation.steps === 2;
      }
    },
    {
      name: 'Faz 2 aşırı harcama tavanı sınırı (FutBIN * (1 + eşik)) aşılmamalı',
      fn: () => {
        // FutBIN = 1000, eşik = 0.50 -> tavan = 1500. buyNow = 1400 -> priceAbove(1400) = 1500. Bir sonraki 1600 (>1500) olamaz.
        const t = { name: 'P4', buyNow: 1400, price: 1000, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 5, maxSteps: 3, steps: 1, activeMs: 5 * 60 * 1000 } };
        const res = recordEscalationSearch(t, { matchFound: false, elapsedMs: 1000, canProgress: true }, { now, maxPriceCapThreshold: 0.50 });
        const eff = computeEffectiveBuyNow(t, { now, maxPriceCapThreshold: 0.50 });
        return eff.effectiveBuyNow === 1500 && eff.isAtCeiling;
      }
    },
    {
      name: 'maxSteps ile Faz 2 tavanından düşük olan sınır seçilmeli',
      fn: () => {
        // FutBIN = 10000, tavan = 15000. buyNow = 10000, maxSteps = 1 -> tavan 10250. 15000 yerine 10250 olmalı.
        const t = { name: 'P5', buyNow: 10000, price: 10000, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 5, maxSteps: 1, steps: 5, activeMs: 0 } };
        const eff = computeEffectiveBuyNow(t, { now, maxPriceCapThreshold: 0.50 });
        return eff.effectiveBuyNow === 10250 && eff.stepsApplied === 1;
      }
    },
    {
      name: 'FutBIN referansı null/geçersiz iken artırma yapılmamalı',
      fn: () => {
        const t = { name: 'P6', buyNow: 1000, price: null, priceUpdatedAt: null, escalation: { enabled: true, afterMinutes: 5, maxSteps: 3, steps: 0, activeMs: 5 * 60 * 1000 } };
        const res = recordEscalationSearch(t, { matchFound: false, elapsedMs: 1000, canProgress: true }, { now });
        return !res.steppedUp && t.escalation.steps === 0;
      }
    },
    {
      name: 'Satın alma sonrası resetEscalationOnPurchase ile adımlar sıfırlanmalı',
      fn: () => {
        const t = { name: 'P7', buyNow: 1000, price: 2000, escalation: { enabled: true, steps: 2, activeMs: 12000, ceilingLogged: true } };
        resetEscalationOnPurchase(t);
        return t.escalation.steps === 0 && t.escalation.activeMs === 0 && !t.escalation.ceilingLogged;
      }
    },
    {
      name: 'Eşleşme bulununca activeMs sıfırlanmalı fakat steps korunmalı',
      fn: () => {
        const t = { name: 'P8', buyNow: 1000, price: 2000, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 10, maxSteps: 3, steps: 2, activeMs: 30000 } };
        recordEscalationSearch(t, { matchFound: true, elapsedMs: 1000, canProgress: true }, { now });
        return t.escalation.steps === 2 && t.escalation.activeMs === 0;
      }
    },
    {
      name: 'Kullanıcı buyNow değiştirdiğinde resetEscalationOnManualChange ile sıfırlanmalı',
      fn: () => {
        const t = { name: 'P9', buyNow: 1000, escalation: { enabled: true, steps: 3, activeMs: 4000 } };
        resetEscalationOnManualChange(t);
        return t.escalation.steps === 0 && t.escalation.activeMs === 0;
      }
    },
    {
      name: '1.000 sınır geçişi: 950 -> 1.000 -> 1.100 basamak atlaması',
      fn: () => {
        const t = { name: 'P10', buyNow: 950, price: 5000, priceUpdatedAt: now, escalation: { enabled: true, maxSteps: 3, steps: 2 } };
        // 950 -> step 1: 1000, step 2: 1100
        const eff = computeEffectiveBuyNow(t, { now });
        return eff.effectiveBuyNow === 1100;
      }
    },
    {
      name: '10.000 sınır geçişi: 9.900 -> 10.000 -> 10.250 basamak atlaması',
      fn: () => {
        const t = { name: 'P11', buyNow: 9900, price: 20000, priceUpdatedAt: now, escalation: { enabled: true, maxSteps: 3, steps: 2 } };
        // 9900 -> step 1: 10000, step 2: 10250 (tier step 250)
        const eff = computeEffectiveBuyNow(t, { now });
        return eff.effectiveBuyNow === 10250;
      }
    },
    {
      name: 'Tavan düşünce efektif fiyatın aşağı çekilmesi',
      fn: () => {
        // buyNow = 1000, steps = 3 -> 1300. FutBIN aniden 1000'e düştü (tavan 1100).
        const t = { name: 'P12', buyNow: 1000, price: 1000, priceUpdatedAt: now, escalation: { enabled: true, maxSteps: 3, steps: 3 } };
        const eff = computeEffectiveBuyNow(t, { now, maxPriceCapThreshold: 0.10 }); // tavan 1100
        return eff.effectiveBuyNow === 1100 && eff.isAtCeiling;
      }
    },
    {
      name: 'Tavana ulaştı logunun tek kez yazılması',
      fn: () => {
        const t = { name: 'P13', buyNow: 1000, price: 5000, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 5, maxSteps: 1, steps: 1, activeMs: 5 * 60 * 1000, ceilingLogged: false } };
        const res1 = recordEscalationSearch(t, { matchFound: false, elapsedMs: 1000, canProgress: true }, { now });
        const res2 = recordEscalationSearch(t, { matchFound: false, elapsedMs: 5 * 60 * 1000, canProgress: true }, { now });
        return Boolean(res1.logMessage) && !res2.logMessage && t.escalation.ceilingLogged === true;
      }
    },
    {
      name: 'Zarar riski uyarısı: efektif fiyat > FutBIN * 0.95',
      fn: () => {
        // FutBIN = 1000 -> %95'i 950. efektif fiyat = 1000 ise isRiskOfLoss true olmalı
        const t = { name: 'P14', buyNow: 1000, price: 1000, priceUpdatedAt: now, escalation: { enabled: true, maxSteps: 1, steps: 0 } };
        const eff = computeEffectiveBuyNow(t, { now });
        return eff.isRiskOfLoss === true;
      }
    },
    {
      name: 'Eski kayıt (escalation alanı yok) varsayılan kapalı çalışmalı',
      fn: () => {
        const t = { name: 'P15', buyNow: 2500, price: 5000, priceUpdatedAt: now };
        const eff = computeEffectiveBuyNow(t, { now });
        return eff.effectiveBuyNow === 2500 && eff.stepsApplied === 0;
      }
    }
  ];

  let passed = 0;
  let failed = 0;
  for (const tc of testCases) {
    try {
      const ok = tc.fn();
      if (ok) {
        passed++;
      } else {
        failed++;
        console.error(`[Escalation Test FAIL] ${tc.name}`);
      }
    } catch (err) {
      failed++;
      console.error(`[Escalation Test ERROR] ${tc.name}:`, err);
    }
  }

  const summary = `[FutRUSH Escalation Test] Toplam: ${testCases.length} | Geçen: ${passed} | Kalan (Başarısız): ${failed}`;
  console.log(summary);
  return { total: testCases.length, passed, failed };
}

if (typeof window !== 'undefined') {
  window.__testEscalation = runEscalationSelfTests;
  window.__escalationDebug = {
    fastForward(targetId, ms) {
      const target = (window.__FUTRUSH__?.state?.targets || []).find((t) => t.id === targetId || t.name === targetId);
      if (!target || !target.escalation) return false;
      target.escalation.activeMs = (Number(target.escalation.activeMs) || 0) + Number(ms);
      return true;
    }
  };
}
