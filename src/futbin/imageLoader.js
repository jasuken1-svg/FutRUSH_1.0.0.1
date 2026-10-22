// EA Web App CSP ve Hotlink engellerini asmak icin GM_xmlhttpRequest tabanli Base64 Data URL resim yukleyici.
// Eşzamanlı istek kuyruğu, Promise tekilleştirme, LRU bellek önbelleği ve negatif önbellek içerir.

import { enqueueFutbinRequest } from './requestQueue.js';

export const FUTBIN_REFERER = 'https://www.futbin.org/';
const MAX_CACHE_BYTES = 30 * 1024 * 1024; // 30 MB
const NEGATIVE_CACHE_TTL_MS = 60 * 1000; // 60 saniye

// LRU Önbellek: Map<url, { dataUrl: string, bytes: number }>
const imageDataCache = new Map();
let currentCacheBytes = 0;

// URL -> Promise<string>
const inflightRequests = new Map();

// URL -> timestamp (ms)
const negativeCache = new Map();


function evictLruIfNeeded(newBytes) {
  while (currentCacheBytes + newBytes > MAX_CACHE_BYTES && imageDataCache.size > 0) {
    const oldestKey = imageDataCache.keys().next().value;
    const entry = imageDataCache.get(oldestKey);
    if (entry) {
      currentCacheBytes -= entry.bytes || 0;
      imageDataCache.delete(oldestKey);
    }
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not return a string'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Blob read error'));
    reader.readAsDataURL(blob);
  });
}

export function clearFutbinImageCache() {
  imageDataCache.clear();
  inflightRequests.clear();
  negativeCache.clear();
  currentCacheBytes = 0;
}

export function fetchImageBlobUrl(url) {
  if (!url || typeof url !== 'string') return Promise.resolve('');
  const trimmed = url.trim();
  if (!trimmed) return Promise.resolve('');

  // 1. Başarılı LRU Önbellek kontrolü
  if (imageDataCache.has(trimmed)) {
    const entry = imageDataCache.get(trimmed);
    // LRU tazeleme (sil ve sona ekle)
    imageDataCache.delete(trimmed);
    imageDataCache.set(trimmed, entry);
    return Promise.resolve(entry.dataUrl);
  }

  // 2. Negatif önbellek kontrolü (60 sn)
  const failedAt = negativeCache.get(trimmed);
  if (failedAt && (Date.now() - failedAt) < NEGATIVE_CACHE_TTL_MS) {
    return Promise.resolve('');
  }
  if (failedAt) {
    negativeCache.delete(trimmed);
  }

  // 3. Eşzamanlı istek tekilleştirme
  if (inflightRequests.has(trimmed)) {
    return inflightRequests.get(trimmed);
  }

  const promise = enqueueFutbinRequest(trimmed, () => new Promise((resolve) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      resolve({ status: 500 });
      return;
    }

    GM_xmlhttpRequest({
      method: 'GET',
      url: trimmed,
      responseType: 'blob',
      timeout: 10000,
      headers: {
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': trimmed.includes('fut.gg') ? 'https://www.fut.gg/' : FUTBIN_REFERER
      },
      onload: (res) => resolve(res),
      onerror: () => resolve({ status: 500 }),
      ontimeout: () => resolve({ status: 504 }),
      onabort: () => resolve({ status: 0 })
    });
  })).then(async (res) => {
    if (res && res.status >= 200 && res.status < 300 && res.response) {
      try {
        const rawHeader = res.responseHeaders || '';
        const match = rawHeader.match(/content-type:\s*([^\r\n;]+)/i);
        const contentType = match ? match[1].trim().toLowerCase() : (res.response.type || '');

        // Yanıt content-type image/ ile başlamıyorsa reddet
        if (contentType && !contentType.startsWith('image/')) {
          negativeCache.set(trimmed, Date.now());
          return '';
        }

        const dataUrl = await blobToDataUrl(res.response);
        if (dataUrl && dataUrl.startsWith('data:image/')) {
          const approxBytes = dataUrl.length * 2;
          evictLruIfNeeded(approxBytes);
          imageDataCache.set(trimmed, { dataUrl, bytes: approxBytes });
          currentCacheBytes += approxBytes;
          negativeCache.delete(trimmed);
          return dataUrl;
        }
      } catch (e) {}
    }
    negativeCache.set(trimmed, Date.now());
    return '';
  }).catch(() => {
    negativeCache.set(trimmed, Date.now());
    return '';
  }).finally(() => {
    inflightRequests.delete(trimmed);
  });

  inflightRequests.set(trimmed, promise);
  return promise;
}

export function loadFutbinImage(imgElement, url, fallbackUrl = '') {
  if (!imgElement) return;
  imgElement.setAttribute('referrerpolicy', 'no-referrer');
  imgElement.setAttribute('crossorigin', 'anonymous');
  imgElement.loading = 'lazy';
  imgElement.crossOrigin = 'anonymous';

  const fallbackList = Array.isArray(fallbackUrl)
    ? fallbackUrl.filter((u) => typeof u === 'string' && u.trim())
    : (typeof fallbackUrl === 'string' && fallbackUrl.trim() ? [fallbackUrl.trim()] : []);

  const primaryUrl = (url || '').trim();
  const allUrls = primaryUrl ? [primaryUrl, ...fallbackList] : fallbackList;
  const requestedKey = allUrls.join(';');

  if (allUrls.length === 0) {
    imgElement.src = '';
    imgElement.style.opacity = '0';
    return;
  }

  // Yeniden kullanılan img elementlerinde eski yanıtın üstüne yazmaması için istek kimliği
  imgElement.dataset.futbinRequested = requestedKey;

  const tryUrl = (index) => {
    if (index >= allUrls.length) {
      if (imgElement.dataset.futbinRequested === requestedKey) {
        imgElement.style.opacity = '0';
      }
      return;
    }
    const targetUrl = allUrls[index];
    fetchImageBlobUrl(targetUrl).then((dataUrl) => {
      if (imgElement.dataset.futbinRequested !== requestedKey) return;
      if (dataUrl) {
        imgElement.src = dataUrl;
        imgElement.style.opacity = '1';
      } else {
        tryUrl(index + 1);
      }
    });
  };

  tryUrl(0);
}

export function applyFutbinBgImage(element, url, fallbackUrl = '') {
  if (!element) return;
  const fallbackList = Array.isArray(fallbackUrl)
    ? fallbackUrl.filter((u) => typeof u === 'string' && u.trim())
    : (typeof fallbackUrl === 'string' && fallbackUrl.trim() ? [fallbackUrl.trim()] : []);

  const primaryUrl = (url || '').trim();
  const allUrls = primaryUrl ? [primaryUrl, ...fallbackList] : fallbackList;
  const requestedKey = allUrls.join(';');

  if (allUrls.length === 0) {
    element.style.backgroundImage = 'none';
    return;
  }

  element.dataset.futbinBgRequested = requestedKey;

  const tryUrl = (index) => {
    if (index >= allUrls.length) {
      if (element.dataset.futbinBgRequested === requestedKey) {
        element.style.backgroundImage = 'none';
      }
      return;
    }
    const targetUrl = allUrls[index];
    fetchImageBlobUrl(targetUrl).then((dataUrl) => {
      if (element.dataset.futbinBgRequested !== requestedKey) return;
      if (dataUrl) {
        element.style.backgroundImage = `url("${dataUrl}")`;
      } else {
        tryUrl(index + 1);
      }
    });
  };

  tryUrl(0);
}
