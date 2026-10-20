// EA Web App CSP ve Hotlink engellerini asmak icin GM_xmlhttpRequest tabanli Base64 Data URL resim yukleyici.
// Eşzamanlı istek kuyruğu (max 6), Promise tekilleştirme, LRU bellek önbelleği ve negatif önbellek içerir.

export const FUTBIN_REFERER = 'https://www.futbin.org/';
const MAX_CONCURRENT = 6;
const MAX_CACHE_BYTES = 30 * 1024 * 1024; // 30 MB
const NEGATIVE_CACHE_TTL_MS = 60 * 1000; // 60 saniye

// LRU Önbellek: Map<url, { dataUrl: string, bytes: number }>
const imageDataCache = new Map();
let currentCacheBytes = 0;

// URL -> Promise<string>
const inflightRequests = new Map();

// URL -> timestamp (ms)
const negativeCache = new Map();

// Eşzamanlı istek kuyruğu
let activeRequests = 0;
const requestQueue = [];

function pumpQueue() {
  while (activeRequests < MAX_CONCURRENT && requestQueue.length > 0) {
    const nextTask = requestQueue.shift();
    if (nextTask) {
      activeRequests++;
      nextTask().finally(() => {
        activeRequests--;
        pumpQueue();
      });
    }
  }
}

function enqueueRequest(taskFn) {
  return new Promise((resolve, reject) => {
    requestQueue.push(() => taskFn().then(resolve, reject));
    pumpQueue();
  });
}

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

  const promise = enqueueRequest(() => new Promise((resolve) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      resolve('');
      return;
    }

    GM_xmlhttpRequest({
      method: 'GET',
      url: trimmed,
      responseType: 'blob',
      timeout: 10000,
      headers: {
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': FUTBIN_REFERER
      },
      onload: async (res) => {
        if (res.status >= 200 && res.status < 300 && res.response) {
          try {
            const rawHeader = res.responseHeaders || '';
            const match = rawHeader.match(/content-type:\s*([^\r\n;]+)/i);
            const contentType = match ? match[1].trim().toLowerCase() : (res.response.type || '');

            // Yanıt content-type image/ ile başlamıyorsa reddet
            if (contentType && !contentType.startsWith('image/')) {
              negativeCache.set(trimmed, Date.now());
              resolve('');
              return;
            }

            const dataUrl = await blobToDataUrl(res.response);
            if (dataUrl && dataUrl.startsWith('data:image/')) {
              const approxBytes = dataUrl.length * 2;
              evictLruIfNeeded(approxBytes);
              imageDataCache.set(trimmed, { dataUrl, bytes: approxBytes });
              currentCacheBytes += approxBytes;
              negativeCache.delete(trimmed);
              resolve(dataUrl);
              return;
            }
          } catch (e) {}
        }
        negativeCache.set(trimmed, Date.now());
        resolve('');
      },
      onerror: () => {
        negativeCache.set(trimmed, Date.now());
        resolve('');
      },
      ontimeout: () => {
        negativeCache.set(trimmed, Date.now());
        resolve('');
      }
    });
  })).finally(() => {
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

  const requestedUrl = (url || fallbackUrl || '').trim();
  if (!requestedUrl) {
    imgElement.src = '';
    imgElement.style.opacity = '0';
    return;
  }

  // Yeniden kullanılan img elementlerinde eski yanıtın üstüne yazmaması için istek kimliği
  imgElement.dataset.futbinRequested = requestedUrl;

  const applySrc = (targetUrl, isFallback = false) => {
    fetchImageBlobUrl(targetUrl).then((dataUrl) => {
      if (imgElement.dataset.futbinRequested !== requestedUrl) return;

      if (dataUrl) {
        imgElement.src = dataUrl;
        imgElement.style.opacity = '1';
      } else if (!isFallback && fallbackUrl && fallbackUrl !== targetUrl) {
        // Birincil URL başarısız oldu, fallback URL'yi GM ile indir
        applySrc(fallbackUrl, true);
      } else {
        // GM ile her ikisi de başarısız olduysa gizle, hotlink ile CSP hatası üretme
        imgElement.style.opacity = '0';
      }
    });
  };

  applySrc(url || fallbackUrl);
}

export function applyFutbinBgImage(element, url, fallbackUrl = '') {
  if (!element) return;
  const targetUrl = (url || fallbackUrl || '').trim();
  if (!targetUrl) {
    element.style.backgroundImage = 'none';
    return;
  }

  element.dataset.futbinBgRequested = targetUrl;

  const applyBg = (u, isFallback = false) => {
    fetchImageBlobUrl(u).then((dataUrl) => {
      if (element.dataset.futbinBgRequested !== targetUrl) return;

      if (dataUrl) {
        element.style.backgroundImage = `url("${dataUrl}")`;
      } else if (!isFallback && fallbackUrl && fallbackUrl !== u) {
        applyBg(fallbackUrl, true);
      } else {
        element.style.backgroundImage = 'none';
      }
    });
  };

  applyBg(url || fallbackUrl);
}
