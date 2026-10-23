// Max Price Cap Guard (Faz 2: Koruma Katmanı - Aşama 3)
// Kullanıcının yanlışlıkla fazla sıfır girmesi veya pazar fiyatının çok üstünde alım yapmasını engeller.
// Referans: FutBIN fiyatı * (1 + threshold).
// Bağımlılıklar: ea/priceSteps, ui/marketLogBox, core/events, core/state

import { parsePriceInput, roundDownToStep } from './priceSteps.js';
import { addMarketLog } from '../ui/marketLogBox.js';
import { emit } from '../core/events.js';
import { state } from '../core/state.js';

export const DEFAULT_MAX_PRICE_THRESHOLD = 0.50; // %50 üzeri aşırı fiyat kabul edilir

/**
 * Satın Al değerinin FutBIN referans fiyatını aşıp aşmadığını denetler.
 * Kural: Eğer FutBIN fiyatı varsa (örn. 8000) ve SATIN AL > FutBIN (örn. 8100),
 * kart aşırı fiyatlıdır (zararına alım / fazla fiyat).
 * @param {number} buyNow - Hedefin veya teklifin SATIN AL fiyatı
 * @param {number|null} futbinPrice - FutBIN referans fiyatı
 * @returns {boolean} Fiyat FutBIN değerini aşıyor mu
 */
export function isExceedingFutbin(buyNow, futbinPrice) {
  const buy = Number(buyNow) || 0;
  const fb = Number(futbinPrice);
  if (!Number.isFinite(fb) || fb <= 0 || buy <= 0) return false;
  return buy > fb;
}

/**
 * Bir kart için FutBIN referans fiyatını baz alarak izin verilen maksimum tavan fiyatı hesaplar.
 * @param {number|null} futbinPrice - FutBIN referans fiyatı
 * @param {number} [thresholdRate] - Opsiyonel oran (varsayılan: state veya 0.50)
 * @returns {number|null} Tavan fiyat veya null (referans yoksa)
 */
export function calculateMaxAllowedPrice(futbinPrice, thresholdRate) {
  const fb = Number(futbinPrice);
  if (!Number.isFinite(fb) || fb <= 0) return null;

  const rate = typeof thresholdRate === 'number' && Number.isFinite(thresholdRate) && thresholdRate > 0
    ? thresholdRate
    : (Number(state.snipeSettings?.maxPriceCapThreshold) || DEFAULT_MAX_PRICE_THRESHOLD);

  const rawCap = fb * (1 + rate);
  return roundDownToStep(rawCap);
}

/**
 * Girilen Buy Now fiyatını FutBIN referans fiyatına göre kontrol eder.
 * @param {number} enteredBuyNow - Kullanıcının girdiği Buy Now
 * @param {number|null} futbinPrice - FutBIN referans fiyatı
 * @param {object} [options]
 * @returns {{ allowed: boolean, maxAllowed: number|null, reason?: string }}
 */
export function validatePriceCap(enteredBuyNow, futbinPrice, options = {}) {
  const buyNow = Number(enteredBuyNow) || 0;
  const fb = Number(futbinPrice);

  // FutBIN fiyatı yoksa veya okunamadıysa engelleme, izin ver (opsiyonel uyarı)
  if (!Number.isFinite(fb) || fb <= 0) {
    return { allowed: true, maxAllowed: null };
  }

  const maxAllowed = calculateMaxAllowedPrice(fb, options.thresholdRate);
  if (maxAllowed === null) {
    return { allowed: true, maxAllowed: null };
  }

  if (buyNow > maxAllowed) {
    const ratePercent = Math.round(((Number(options.thresholdRate) || (Number(state.snipeSettings?.maxPriceCapThreshold) || DEFAULT_MAX_PRICE_THRESHOLD))) * 100);
    return {
      allowed: false,
      maxAllowed,
      futbinPrice: fb,
      reason: `Fiyat FutBIN piyasa değerinin (${fb.toLocaleString('tr-TR')}) %${ratePercent} üzerinde (${buyNow.toLocaleString('tr-TR')} > ${maxAllowed.toLocaleString('tr-TR')}). Fazla sıfır koruması devrede.`
    };
  }

  return { allowed: true, maxAllowed };
}

/**
 * Satın alma öncesi veya hedef ekleme anında korumayı çalıştırır.
 * Reddedilirse Genel Loglar'a uyarı basar ve state uyarısı fırlatır.
 * @param {object} target - Hedef nesnesi ({ name, buyNow, price })
 * @param {number} offerPrice - Teklif / Satın alma fiyatı
 * @returns {boolean} Alıma izin veriliyor mu
 */
export function checkPriceCapGuard(target, offerPrice, options = {}) {
  const futbinRef = Number(target?.price);
  const priceToCheck = offerPrice != null ? Number(offerPrice) : Number(target?.buyNow);
  const strictMode = options.strictMarketCap !== undefined
    ? Boolean(options.strictMarketCap)
    : Boolean(state.snipeSettings?.strictMarketCap);

  // Katı Mod aktifse: SATIN AL > FutBIN olduğunda kesinlikle engelle
  if (strictMode && isExceedingFutbin(priceToCheck, futbinRef)) {
    const text = `🛡️ [Fiyat Koruması - Katı Mod] ${target?.name || 'Oyuncu'}: Satın Al (${priceToCheck.toLocaleString('tr-TR')}) FutBIN piyasa fiyatını (${futbinRef.toLocaleString('tr-TR')}) aşıyor! Tarama ve satın alma engellendi.`;
    addMarketLog({
      text,
      type: 'error'
    });
    emit('target:price-cap-exceeded', { target, offerPrice: priceToCheck, reason: 'exceeds_futbin' });
    return false;
  }

  // Tavan Eşik Kontrolü (Max Price Cap Guard): FutBIN * (1 + threshold) aşılırsa (fazla sıfır) engelle
  const result = validatePriceCap(priceToCheck, futbinRef);
  if (!result.allowed) {
    const text = `🛡️ [Fiyat Koruması] ${target?.name || 'Oyuncu'}: Aşırı tavan fiyat/fazla sıfır engellendi! ${result.reason}`;
    addMarketLog({
      text,
      type: 'error'
    });
    emit('target:price-cap-exceeded', { target, offerPrice: priceToCheck, result });
    return false;
  }

  return true;
}
