// EA Web App CSP ve Hotlink engellerini asmak icin GM_xmlhttpRequest tabanli Base64 Data URL resim yukleyici.
// Bellek onbellegi (in-memory Map cache) ile ayni resmi birden fazla kez indirmez.

const imageDataCache = new Map();

export function clearFutbinImageCache() {
  imageDataCache.clear();
}

function arrayBufferToBase64DataUrl(buffer, contentType = 'image/png') {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : (typeof Buffer !== 'undefined' ? Buffer.from(binary, 'binary').toString('base64') : '');
  return `data:${contentType};base64,${base64}`;
}

export function fetchImageBlobUrl(url) {
  if (!url || typeof url !== 'string') return Promise.resolve('');
  const trimmed = url.trim();
  if (imageDataCache.has(trimmed)) {
    return Promise.resolve(imageDataCache.get(trimmed));
  }

  return new Promise((resolve) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      resolve('');
      return;
    }

    GM_xmlhttpRequest({
      method: 'GET',
      url: trimmed,
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://www.futbin.org/'
      },
      onload: (res) => {
        if (res.status >= 200 && res.status < 300 && res.response) {
          try {
            const contentType = res.responseHeaders?.match(/content-type:\s*([^\r\n;]+)/i)?.[1] || 'image/png';
            const dataUrl = arrayBufferToBase64DataUrl(res.response, contentType);
            if (dataUrl) {
              imageDataCache.set(trimmed, dataUrl);
              resolve(dataUrl);
              return;
            }
          } catch (e) {}
        }
        resolve('');
      },
      onerror: () => resolve(''),
      ontimeout: () => resolve('')
    });
  });
}

export function loadFutbinImage(imgElement, url, fallbackUrl = '') {
  if (!imgElement) return;
  imgElement.setAttribute('referrerpolicy', 'no-referrer');
  imgElement.setAttribute('crossorigin', 'anonymous');
  imgElement.loading = 'lazy';
  imgElement.crossOrigin = 'anonymous';

  if (!url) {
    if (fallbackUrl) imgElement.src = fallbackUrl;
    return;
  }

  const trimmed = url.trim();
  if (imageDataCache.has(trimmed)) {
    imgElement.src = imageDataCache.get(trimmed);
    return;
  }

  fetchImageBlobUrl(trimmed).then((dataUrl) => {
    if (dataUrl) {
      imgElement.src = dataUrl;
    } else {
      imgElement.onerror = () => {
        if (fallbackUrl && imgElement.src !== fallbackUrl) {
          imgElement.src = fallbackUrl;
        }
      };
      imgElement.src = trimmed || fallbackUrl;
    }
  });
}

export function applyFutbinBgImage(element, url, fallbackUrl = '') {
  if (!element || !url) return;
  const trimmed = url.trim();
  if (imageDataCache.has(trimmed)) {
    element.style.backgroundImage = 'url("' + imageDataCache.get(trimmed) + '")';
    return;
  }

  fetchImageBlobUrl(trimmed).then((dataUrl) => {
    const finalUrl = dataUrl || trimmed || fallbackUrl;
    if (finalUrl && element) {
      element.style.backgroundImage = 'url("' + finalUrl + '")';
    }
  });
}
