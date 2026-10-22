// FutBIN HTML ve API kaynaklarina kuyruk denetimli HTTP istekleri gonderir.
// Bagimliliklar: futbin/requestQueue.

import { enqueueFutbinRequest } from './requestQueue.js';

export function requestFutbinPage(url) {
  return enqueueFutbinRequest(url, () => new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      reject(new Error('FutBIN isteği için GM_xmlhttpRequest kullanılamıyor. Userscript izinlerini kontrol edin.'));
      return;
    }
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      timeout: 25000,
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
      onload: (response) => resolve(response),
      onerror: () => reject(new Error('FutBIN bağlantısı kurulamadı. Ağ bağlantınızı kontrol edin.')),
      ontimeout: () => reject(new Error('FutBIN yanıtı zaman aşımına uğradı.')),
      onabort: () => reject(new Error('FutBIN isteği iptal edildi.'))
    });
  }));
}

export function requestFutbinApi(url) {
  return enqueueFutbinRequest(url, () => new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      reject(new Error('FutBIN isteği için GM_xmlhttpRequest kullanılamıyor.'));
      return;
    }
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      timeout: 20000,
      headers: { 'Accept': 'application/json, text/plain, */*' },
      onload: (response) => resolve(response),
      onerror: () => reject(new Error('FutBIN API bağlantısı kurulamadı.')),
      ontimeout: () => reject(new Error('FutBIN API yanıtı zaman aşımına uğradı.')),
      onabort: () => reject(new Error('FutBIN API isteği iptal edildi.'))
    });
  }));
}
