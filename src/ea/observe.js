// EA servis isteklerinin tamamlanma, hata ve zaman asimi durumlarini gozlemler.
// Bagimlilik: EA sayfasinin Observable/Promise davranisi.

import { pageWindow } from '../utils/dom.js';

export function observeEaRequest(observable, timeoutMs) {
  return new Promise((resolve) => {
    if (!observable || typeof observable.observe !== 'function') {
      resolve({ success: false, invalid: true, error: 'EA isteği gözlemlenemedi.' });
      return;
    }
    const scope = {};
    let finished = false;
    let timer = 0;
    let senderRef = observable;
    const finish = (response) => {
      if (finished) return;
      finished = true;
      if (timer) pageWindow.clearTimeout(timer);
      try { (senderRef || observable).unobserve(scope); } catch (e) {}
      resolve(response || { success: false });
    };
    timer = pageWindow.setTimeout(() => finish({ success: false, timeout: true }), timeoutMs || 15000);
    try { observable.observe(scope, (sender, response) => { senderRef = sender || observable; finish(response); }); }
    catch (error) { finish({ success: false, error: error.message || String(error) }); }
  });
}
