// EA servis isteklerinin tamamlanma, hata ve zaman asimi durumlarini gozlemler.
// Bagimlilik: EA sayfasinin Observable/Promise davranisi.

import { pageWindow } from '../utils/dom.js';
import { debug } from '../core/logger.js';
import { safetyGovernor, SafetyGovernor } from '../bot/safetyGovernor.js';
import { errorCode } from './errorCodes.js';

export function isCaptchaResponse(response) {
  if (!response) return false;
  const captchaCode = errorCode('CAPTCHA_REQUIRED') ?? 458;
  const code = response.error?.code ?? response.error?.status ?? response.status ?? response.code;
  if (code !== null && code !== undefined && (code === captchaCode || String(code) === String(captchaCode) || String(code) === '458')) {
    return true;
  }
  const msg = response.error?.message || response.error || response.message || '';
  if (typeof msg === 'string' && /captcha/i.test(msg)) {
    return true;
  }
  return false;
}

export function observeEaRequest(observable, timeoutMs) {
  if (safetyGovernor.isCaptchaHalted()) {
    return Promise.resolve({ success: false, blocked: true, error: 'CAPTCHA kilitli: Tüm giden EA istekleri durduruldu.' });
  }
  return new Promise((resolve) => {
    if (!observable || typeof observable.observe !== 'function') {
      resolve({ success: false, invalid: true, error: 'EA isteği gözlemlenemedi.' });
      return;
    }
    const safeSetTimeout = typeof pageWindow?.setTimeout === 'function' ? pageWindow.setTimeout.bind(pageWindow) : setTimeout;
    const safeClearTimeout = typeof pageWindow?.clearTimeout === 'function' ? pageWindow.clearTimeout.bind(pageWindow) : clearTimeout;
    const scope = {};
    let finished = false;
    let timer = 0;
    let senderRef = observable;
    const finish = (response) => {
      if (finished) return;
      finished = true;
      if (timer) safeClearTimeout(timer);
      try { (senderRef || observable).unobserve(scope); } catch (e) {
        debug('[FutRUSH:ea]', 'EA istek gözlemi temizlenemedi.', String(e?.message || e));
      }
      if (isCaptchaResponse(response)) {
        SafetyGovernor.halt('captcha');
      }
      resolve(response || { success: false });
    };
    timer = safeSetTimeout(() => finish({ success: false, timeout: true }), timeoutMs || 15000);
    try { observable.observe(scope, (sender, response) => { senderRef = sender || observable; finish(response); }); }
    catch (error) { finish({ success: false, error: error.message || String(error) }); }
  });
}
