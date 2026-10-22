// Arkose Labs / FunCaptcha ve EA Captcha yanit kodlarini tespit eder.
// Tespit aninda SafetyGovernor.halt('captcha') cagirir ve EA isteklerini kilitler.

import { pageWindow } from '../utils/dom.js';
import { debug } from '../core/logger.js';
import { SafetyGovernor, safetyGovernor } from '../bot/safetyGovernor.js';

export const CAPTCHA_SELECTORS = [
  'iframe[src*="arkoselabs"]',
  'iframe[src*="funcaptcha"]',
  '#fc-iframe-wrap',
  '#Arkose',
  '#arkose',
  '[data-theme="arkose"]',
  '[id*="arkose" i]',
  '[id*="funcaptcha" i]',
  '[class*="arkose" i]',
  '[class*="funcaptcha" i]'
];

export function isCaptchaElement(node) {
  if (!node || node.nodeType !== 1) return false;
  const tag = (node.tagName || '').toLowerCase();
  if (tag === 'iframe') {
    const src = (node.getAttribute?.('src') || node.src || '').toLowerCase();
    if (src.includes('arkoselabs') || src.includes('funcaptcha')) return true;
  }
  const id = (node.id || '').toLowerCase();
  const className = (typeof node.className === 'string' ? node.className : '').toLowerCase();
  if (id.includes('arkose') || id.includes('funcaptcha') || id.includes('fc-iframe-wrap')) return true;
  if (className.includes('arkose') || className.includes('funcaptcha')) return true;
  if (typeof node.querySelector === 'function') {
    try {
      for (const sel of CAPTCHA_SELECTORS) {
        if (node.querySelector(sel)) return true;
      }
    } catch {}
  }
  return false;
}

export function checkCaptchaInDom(root = document) {
  if (!root || typeof root.querySelector !== 'function') return false;
  try {
    for (const sel of CAPTCHA_SELECTORS) {
      if (root.querySelector(sel)) return true;
    }
  } catch {}
  return false;
}

function isEaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.toLowerCase();
  // Do not match Arkose or FunCaptcha resources
  if (u.includes('arkoselabs') || u.includes('funcaptcha')) return false;
  return (
    u.includes('utas.') ||
    u.includes('/ut/game/') ||
    u.includes('ea.com/ea-sports-fc') ||
    u.includes('ea.com/fifa')
  );
}

let observerInstance = null;
const hookedWindows = new WeakSet();

export function initDomCaptchaDetector(deps = {}) {
  const doc = deps.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;
  const target = doc.body || doc.documentElement;
  if (!target) return null;

  if (checkCaptchaInDom(doc)) {
    SafetyGovernor.halt('captcha');
  }

  const ObserverClass = deps.MutationObserver || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
  if (!ObserverClass) return null;

  const observer = new ObserverClass((mutations) => {
    if (safetyGovernor.isCaptchaHalted()) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (node.nodeType === 1 && (isCaptchaElement(node) || checkCaptchaInDom(node))) {
          debug('[FutRUSH:captcha]', 'Arkose/FunCaptcha DOM elementi tespit edildi.');
          SafetyGovernor.halt('captcha');
          return;
        }
      }
    }
  });

  try {
    observer.observe(target, { childList: true, subtree: true });
  } catch {}
  return observer;
}

export function initNetworkCaptchaDetector(deps = {}) {
  const win = deps.window || pageWindow;
  if (!win || hookedWindows.has(win)) return;
  hookedWindows.add(win);

  // Intercept fetch
  if (typeof win.fetch === 'function') {
    const origFetch = win.fetch;
    win.fetch = async function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      if (isEaUrl(url) && safetyGovernor.isCaptchaHalted()) {
        throw new Error('EA isteği kilitlendi: Captcha çözülmesi bekleniyor.');
      }
      const response = await origFetch.apply(this, args);
      if (response && Number(response.status) === 458) {
        debug('[FutRUSH:captcha]', 'EA ağ yanıtında 458 (Captcha) kodu tespit edildi (fetch).');
        SafetyGovernor.halt('captcha');
      }
      return response;
    };
  }

  // Intercept XMLHttpRequest
  if (typeof win.XMLHttpRequest === 'function') {
    const OrigXHR = win.XMLHttpRequest;
    const origOpen = OrigXHR.prototype.open;
    const origSend = OrigXHR.prototype.send;

    OrigXHR.prototype.open = function(method, url, ...rest) {
      this.__frUrl = url;
      return origOpen.apply(this, [method, url, ...rest]);
    };

    OrigXHR.prototype.send = function(...args) {
      if (isEaUrl(this.__frUrl) && safetyGovernor.isCaptchaHalted()) {
        try { this.abort(); } catch {}
        throw new Error('EA isteği kilitlendi: Captcha çözülmesi bekleniyor.');
      }
      this.addEventListener('load', () => {
        if (Number(this.status) === 458) {
          debug('[FutRUSH:captcha]', 'EA ağ yanıtında 458 (Captcha) kodu tespit edildi (XHR).');
          SafetyGovernor.halt('captcha');
        }
      });
      return origSend.apply(this, args);
    };
  }
}

export function initCaptchaDetector(deps = {}) {
  observerInstance = initDomCaptchaDetector(deps);
  initNetworkCaptchaDetector(deps);
  return {
    destroy: () => {
      if (observerInstance) {
        try { observerInstance.disconnect(); } catch {}
        observerInstance = null;
      }
    }
  };
}
