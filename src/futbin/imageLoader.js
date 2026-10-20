// EA Web App CSP ve Hotlink engellerini asmak icin GM_xmlhttpRequest tabanli resim yukleyici.
// Bellek onbellegi (in-memory Map cache) ile ayni resmi birden fazla kez indirmez.

const imageBlobCache = new Map();

export function clearFutbinImageCache() {
  imageBlobCache.clear();
}

export function fetchImageBlobUrl(url) {
  if (!url || typeof url !== 'string') return Promise.resolve('');
  const trimmed = url.trim();
  if (imageBlobCache.has(trimmed)) {
    return Promise.resolve(imageBlobCache.get(trimmed));
  }

  return new Promise((resolve) => {
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
        'Referer': 'https://www.futbin.org/'
      },
      onload: (res) => {
        if (res.status >= 200 && res.status < 300 && res.response) {
          try {
            const blobUrl = URL.createObjectURL(res.response);
            imageBlobCache.set(trimmed, blobUrl);
            resolve(blobUrl);
            return;
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
  if (imageBlobCache.has(trimmed)) {
    imgElement.src = imageBlobCache.get(trimmed);
    return;
  }

  // Once GM_xmlhttpRequest ile blob cekmeyi dene (CSP ve 403 bypass)
  fetchImageBlobUrl(trimmed).then((blobUrl) => {
    if (blobUrl) {
      imgElement.src = blobUrl;
    } else {
      // GM basarisiz olursa dogrudan URL veya fallback ata
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
  if (imageBlobCache.has(trimmed)) {
    element.style.backgroundImage = 'url("' + imageBlobCache.get(trimmed) + '")';
    return;
  }

  fetchImageBlobUrl(trimmed).then((blobUrl) => {
    const finalUrl = blobUrl || trimmed || fallbackUrl;
    if (finalUrl && element) {
      element.style.backgroundImage = 'url("' + finalUrl + '")';
    }
  });
}
