// EA FC Web App Yan Eylem Paneli (Item Action Panel) içine "RUSHbuttonv1" butonu ekler.
// Unassigned, Squads, Transfers ve Club sekmelerinde "Compare Price" ile "Quick Sell" arasına yerleşir.
// Bağımlılıklar: ea/lowestMarketPrice, core/state, bot/safetyGovernor, utils/dom.

import { findLowestMarketPrice } from '../ea/lowestMarketPrice.js';
import { state } from '../core/state.js';
import { safetyGovernor } from '../bot/safetyGovernor.js';
import { pageWindow } from '../utils/dom.js';

export const IDLE_TEXT = 'RUSHbuttonv1';
export const BTN_CLASS = 'futrush-rush-action-btn';
const ISOLATED_EVENTS = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];

let isSearching = false;
let patched = false;
const lastSearchTimeByDefId = new Map();
const COOLDOWN_MS = 2500;

export const RUSH_ACTION_BTN_CSS = `
.${BTN_CLASS} {
  color: #1b5e20 !important;
  font-weight: 700 !important;
  cursor: pointer;
  transition: filter 120ms ease, opacity 120ms ease;
}
.${BTN_CLASS}:hover {
  filter: brightness(1.2);
}
.${BTN_CLASS}[disabled] {
  opacity: 0.65 !important;
  cursor: wait !important;
}
`;

export function injectRushButtonStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('futrush-rush-action-btn-styles')) return;
  const style = document.createElement('style');
  style.id = 'futrush-rush-action-btn-styles';
  style.textContent = RUSH_ACTION_BTN_CSS;
  document.head.appendChild(style);
}

function isolate(btn, onClick) {
  for (const type of ISOLATED_EVENTS) {
    btn.addEventListener(
      type,
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (type === 'click') onClick();
      },
      { passive: false }
    );
  }
}

export function formatResult(r) {
  if (r.status === 'EXTINCT') return 'EXTINCT';
  if (r.status !== 'OK') return 'ERROR';
  const countSuffix = (r.count >= 20 || r.partial) ? `(x${r.count}+)` : `(x${r.count})`;
  return `🪙 ${r.price.toLocaleString('tr-TR')} ${countSuffix}`;
}

export function defaultCanRun() {
  if (state.botRunning) return false;
  if (safetyGovernor?.isCaptchaHalted?.()) return false;
  return true;
}

/**
 * Yan eylem panelinde veya ekranda seçili olan kart nesnesini (itemEntity) tespit eder.
 * @param {Element|object} [panelOrView]
 * @returns {object|null}
 */
export function getSelectedItemEntity(panelOrView) {
  // 1. View nesnesi üzerinden doğrudan data/item kontrolü
  if (panelOrView && typeof panelOrView === 'object') {
    const directItem = panelOrView._item || panelOrView.item || panelOrView._auctionItem || panelOrView.auctionItem || panelOrView.data || panelOrView._data;
    if (directItem?.definitionId > 0) return directItem;
  }

  // 2. EA View Controller hiyerarşisinden seçili kartı al
  try {
    const app = pageWindow.getAppMain?.();
    const root = app?.getRootViewController?.();
    let curr = root?.getPresentedViewController?.() || root;
    for (let i = 0; i < 6 && curr; i++) {
      const item = curr.selectedItem || curr._selectedItem || curr.item || curr._item || curr.viewmodel?.selectedItem || curr._viewmodel?._selectedItem;
      if (item && item.definitionId > 0) {
        return item;
      }
      curr = typeof curr.getCurrentViewController === 'function'
        ? curr.getCurrentViewController()
        : (typeof curr.getCurrentController === 'function' ? curr.getCurrentController() : null);
    }
  } catch (_) {}

  // 3. DOM üzerinden seçili kart elemanından veriyi ayıkla
  if (typeof document !== 'undefined') {
    const selectedEl = document.querySelector('.listFUTItem.selected, li.selected, [aria-selected="true"], .ut-item-view.selected, .ut-split-view__detail');
    if (selectedEl) {
      const defAttr = selectedEl.getAttribute('data-definition-id') || selectedEl.querySelector('[data-definition-id]')?.getAttribute('data-definition-id');
      const resAttr = selectedEl.getAttribute('data-resource-id') || selectedEl.querySelector('[data-resource-id]')?.getAttribute('data-resource-id');
      const eaAttr = selectedEl.getAttribute('data-ea-id') || selectedEl.getAttribute('data-id') || selectedEl.querySelector('[data-ea-id]')?.getAttribute('data-ea-id');
      const img = selectedEl.querySelector('img[src*="/players/"], img[src*="/p"]');
      const imgId = img?.getAttribute('src')?.match(/\/p?(\d+)/i)?.[1];
      const defId = Number(defAttr || resAttr || eaAttr || imgId) || 0;
      if (defId > 0) {
        return {
          definitionId: defId,
          type: 'player',
          category: 'any'
        };
      }
    }
  }

  return null;
}

/**
 * Yan eylem panelindeki "Compare Price" ve "Quick Sell" butonlarını bulur.
 * @param {Element} container
 * @returns {{ compareBtn: Element|null, quickSellBtn: Element|null }}
 */
export function findActionButtons(container) {
  if (!container) return { compareBtn: null, quickSellBtn: null };

  const buttons = Array.from(container.querySelectorAll('button'));
  let compareBtn = null;
  let quickSellBtn = null;

  for (const btn of buttons) {
    if (btn.classList.contains(BTN_CLASS)) continue;
    const text = (btn.textContent || '').trim().toLowerCase();
    const className = String(btn.className || '').toLowerCase();

    // Compare Price tespiti
    if (
      /compare|karşılaştır|karsilastir|vergleichen|comparer|confronta/i.test(text) ||
      className.includes('compare')
    ) {
      compareBtn = btn;
    }

    // Quick Sell tespiti
    if (
      /quick\s*sell|hızlı\s*sat|hizli\s*sat|abstoßen|vente\s*rapide|scarta/i.test(text) ||
      className.includes('quicksell') ||
      className.includes('discard')
    ) {
      quickSellBtn = btn;
    }
  }

  return { compareBtn, quickSellBtn };
}

async function handleButtonClick(btn, deps = {}) {
  if (isSearching) return;

  const itemEntity = getSelectedItemEntity(btn.__panelView || btn.parentElement);
  if (!itemEntity || !itemEntity.definitionId) return;

  const canRunFn = deps.canRun ?? defaultCanRun;
  if (!canRunFn()) {
    btn.textContent = 'LOCKED';
    setTimeout(() => {
      if (btn && btn.textContent === 'LOCKED') btn.textContent = IDLE_TEXT;
    }, 1500);
    return;
  }

  const defId = itemEntity.definitionId;
  const now = Date.now();
  const lastTime = lastSearchTimeByDefId.get(defId) || 0;
  if (now - lastTime < COOLDOWN_MS) return;
  lastSearchTimeByDefId.set(defId, now);

  isSearching = true;
  btn.disabled = true;
  btn.textContent = 'Searching...';

  try {
    const result = await findLowestMarketPrice(itemEntity, {
      ...deps.finderDeps,
      onProgress: ({ step, maxSteps }) => {
        btn.textContent = `Searching ${step}/${maxSteps}...`;
      }
    });

    btn.textContent = formatResult(result);
  } catch (_) {
    btn.textContent = 'ERROR';
  } finally {
    isSearching = false;
    btn.disabled = false;
  }
}

/**
 * Yan eylem panelinin içine "Compare Price" ve "Quick Sell" arasına butonu yerleştirir.
 * @param {Element|object} panelOrView
 * @param {object} [deps]
 */
export function injectRushButtonIntoPanel(panelOrView, deps = {}) {
  const container = panelOrView?.getRootElement?.() || panelOrView?._root || (panelOrView?.nodeType ? panelOrView : null);
  if (!container) return;

  // Buton grubunu bul
  const group = container.querySelector('.ut-button-group') ||
    container.querySelector('.ut-action-list-view') ||
    container.querySelector('.sub-actions') ||
    container;

  const { compareBtn, quickSellBtn } = findActionButtons(group);

  let btn = group.querySelector('.' + BTN_CLASS);
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = IDLE_TEXT;
    btn.dataset.frInjected = 'true';

    // Tasarım ve font uyumu: Compare Price varsa onun sınıflarını kopyala
    if (compareBtn) {
      btn.className = compareBtn.className + ' ' + BTN_CLASS;
    } else if (quickSellBtn) {
      btn.className = quickSellBtn.className + ' ' + BTN_CLASS;
    } else {
      btn.className = 'btn-standard call-to-action ' + BTN_CLASS;
    }

    isolate(btn, () => handleButtonClick(btn, deps));
  }

  btn.__panelView = panelOrView;

  // Seçili kart değiştiyse butonu sıfırla
  const currentItem = getSelectedItemEntity(panelOrView);
  if (currentItem && btn.__currentDefId !== currentItem.definitionId) {
    btn.__currentDefId = currentItem.definitionId;
    if (!isSearching) {
      btn.textContent = IDLE_TEXT;
      btn.disabled = false;
    }
  }

  // Tam konumlandırma: "Compare Price" hemen altına, "Quick Sell" hemen üstüne
  if (compareBtn && compareBtn.parentElement === group) {
    if (compareBtn.nextSibling !== btn) {
      compareBtn.insertAdjacentElement('afterend', btn);
    }
  } else if (quickSellBtn && quickSellBtn.parentElement === group) {
    if (quickSellBtn.previousSibling !== btn) {
      quickSellBtn.insertAdjacentElement('beforebegin', btn);
    }
  } else if (!btn.parentElement) {
    group.appendChild(btn);
  }
}

/**
 * Desteklenen 4 sekmedeki EA Action Panel View sınıflarının prototiplerini kancalar.
 * @param {object} [deps]
 */
export function installRushActionButtons(deps = {}) {
  if (patched) return;
  patched = true;

  injectRushButtonStyles();

  const win = deps.pageWindow || pageWindow;
  const panelClasses = [
    win.UTDefaultActionPanelView,
    win.UTSquadSlotActionPanelView,
    win.UTAuctionActionPanelView,
    win.UTQuickListActionPanelView
  ].filter((cls) => cls && cls.prototype);

  panelClasses.forEach((cls) => {
    const proto = cls.prototype;

    // 1. render kancası
    if (typeof proto.render === 'function') {
      const origRender = proto.render;
      proto.render = function (...args) {
        const res = origRender.apply(this, args);
        try {
          injectRushButtonIntoPanel(this, deps);
        } catch (_) {}
        return res;
      };
    }

    // 2. setItem / setAuctionItem kancası
    ['setItem', 'setAuctionItem', 'init'].forEach((methodName) => {
      if (typeof proto[methodName] === 'function') {
        const origMethod = proto[methodName];
        proto[methodName] = function (...args) {
          const res = origMethod.apply(this, args);
          try {
            injectRushButtonIntoPanel(this, deps);
          } catch (_) {}
          return res;
        };
      }
    });
  });
}

/**
 * DOM senkronizasyonu: Ekranda görünür yan eylem paneli varsa butonu garanti eder.
 * @param {object} [deps]
 */
export function syncRushActionButtons(deps = {}) {
  if (typeof document === 'undefined') return;
  const actionContainers = document.querySelectorAll('.ut-button-group, .ut-action-list-view, .ut-item-details-view, .ut-split-view__detail');
  actionContainers.forEach((container) => {
    try {
      const hasActionButtons = container.querySelector('button');
      if (hasActionButtons) {
        injectRushButtonIntoPanel(container, deps);
      }
    } catch (_) {}
  });
}

export function resetPatchFlagForTesting() {
  patched = false;
  isSearching = false;
}
