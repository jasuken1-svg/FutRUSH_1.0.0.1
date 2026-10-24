// EA FC Web App Yan Eylem Paneli (Item Action Panel) içine "RUSHbuttonv1" butonu ekler.
// Unassigned, Squads, Transfers ve Club sekmelerinde "Compare Price" ile "Quick Sell" arasına yerleşir.
// Bağımlılıklar: ea/lowestMarketPrice, core/state, bot/safetyGovernor, utils/dom.

import { findLowestMarketPrice } from '../ea/lowestMarketPrice.js';
import { state } from '../core/state.js';
import { safetyGovernor } from '../bot/safetyGovernor.js';
import { pageWindow } from '../utils/dom.js';

export const IDLE_TEXT = 'RUSHbuttonv1';
export const BTN_CLASS = 'futrush-rush-action-btn';

let isSearching = false;
let patched = false;
const lastSearchTimeByDefId = new Map();
const COOLDOWN_MS = 2500;

export const RUSH_ACTION_BTN_CSS = `
.${BTN_CLASS},
.${BTN_CLASS} .btn-text {
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

function setButtonLabel(btn, text) {
  if (!btn) return;
  const label = btn.querySelector('.btn-text');
  if (label) {
    label.textContent = text;
  } else {
    btn.textContent = text;
  }
}

function attachButtonEvents(btn, onClick) {
  // 1. Standart tıklama olayı
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  // 2. Mousedown ve touch olaylarının kart seçimini bozmasını engelle (stopPropagation)
  // preventDefault çağrılmaz; böylece tarayıcı click olayını normal şekilde tetikler.
  btn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });
  btn.addEventListener('touchstart', (e) => {
    e.stopPropagation();
  }, { passive: true });
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

function extractItemFromAny(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (Number(obj.definitionId) > 0) return obj;
  if (Number(obj._rushItem?.definitionId) > 0) return obj._rushItem;
  if (Number(obj.item?.definitionId) > 0) return obj.item;
  if (Number(obj._item?.definitionId) > 0) return obj._item;
  if (Number(obj._auctionItem?.item?.definitionId) > 0) return obj._auctionItem.item;
  if (Number(obj.auctionItem?.item?.definitionId) > 0) return obj.auctionItem.item;
  if (Number(obj._auctionItem?.definitionId) > 0) return obj._auctionItem;
  if (Number(obj.data?.definitionId) > 0) return obj.data;
  if (Number(obj._data?.definitionId) > 0) return obj._data;
  if (Number(obj._slot?.item?.definitionId) > 0) return obj._slot.item;
  if (Number(obj.squadSlot?.item?.definitionId) > 0) return obj.squadSlot.item;
  return null;
}

/**
 * Yan eylem panelinde veya ekranda seçili olan kart nesnesini (itemEntity) tespit eder.
 * @param {Element|object} [panelOrView]
 * @returns {object|null}
 */
export function getSelectedItemEntity(panelOrView) {
  // 1. Panel/View nesnesi üzerinden doğrudan kontrol
  const directItem = extractItemFromAny(panelOrView);
  if (directItem?.definitionId > 0) return directItem;

  if (panelOrView?.__panelView) {
    const fromPanel = extractItemFromAny(panelOrView.__panelView);
    if (fromPanel?.definitionId > 0) return fromPanel;
  }

  // 2. EA View Controller hiyerarşisinden seçili kartı al
  try {
    const app = pageWindow.getAppMain?.();
    const root = app?.getRootViewController?.();
    let curr = root?.getPresentedViewController?.() || root;
    for (let i = 0; i < 8 && curr; i++) {
      const candidate = extractItemFromAny(
        curr.selectedItem || curr._selectedItem || curr.item || curr._item ||
        curr.viewmodel?.selectedItem || curr._viewmodel?._selectedItem ||
        curr.viewmodel?.item || curr._viewmodel?._item
      );
      if (candidate?.definitionId > 0) {
        return candidate;
      }
      curr = typeof curr.getCurrentViewController === 'function'
        ? curr.getCurrentViewController()
        : (typeof curr.getCurrentController === 'function' ? curr.getCurrentController() : null);
    }
  } catch (_) {}

  // 3. DOM üzerinden seçili kart elemanından veriyi ayıkla
  if (typeof document !== 'undefined') {
    const candidates = [
      document.querySelector('.ut-split-view__detail .ut-item-view, .ut-split-view__detail .ut-item-card, .ut-item-details-view'),
      document.querySelector('.listFUTItem.selected, li.selected, [aria-selected="true"], .ut-item-view.selected')
    ].filter(Boolean);

    for (const el of candidates) {
      const defAttr = el.getAttribute('data-definition-id') || el.querySelector('[data-definition-id]')?.getAttribute('data-definition-id');
      const resAttr = el.getAttribute('data-resource-id') || el.querySelector('[data-resource-id]')?.getAttribute('data-resource-id');
      const eaAttr = el.getAttribute('data-ea-id') || el.getAttribute('data-id') || el.querySelector('[data-ea-id]')?.getAttribute('data-ea-id');
      const img = el.querySelector('img[src*="/players/"], img[src*="/p"], img[src*="/items/images/"]');
      const imgId = img?.getAttribute('src')?.match(/\/p?(\d+)(?:\.png|\.webp|\.jpg|@|$)/i)?.[1];

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

  setButtonLabel(btn, 'Searching...');
  btn.disabled = true;

  const itemEntity = getSelectedItemEntity(btn.__panelView || btn.parentElement);
  if (!itemEntity || !itemEntity.definitionId) {
    setButtonLabel(btn, 'KART YOK');
    setTimeout(() => {
      setButtonLabel(btn, IDLE_TEXT);
      btn.disabled = false;
    }, 1500);
    return;
  }

  const canRunFn = deps.canRun ?? defaultCanRun;
  if (!canRunFn()) {
    setButtonLabel(btn, 'LOCKED');
    setTimeout(() => {
      setButtonLabel(btn, IDLE_TEXT);
      btn.disabled = false;
    }, 1500);
    return;
  }

  const defId = itemEntity.definitionId;
  const now = Date.now();
  const lastTime = lastSearchTimeByDefId.get(defId) || 0;
  if (now - lastTime < COOLDOWN_MS) {
    btn.disabled = false;
    setButtonLabel(btn, IDLE_TEXT);
    return;
  }
  lastSearchTimeByDefId.set(defId, now);

  isSearching = true;

  try {
    const result = await findLowestMarketPrice(itemEntity, {
      ...deps.finderDeps,
      onProgress: ({ step, maxSteps }) => {
        setButtonLabel(btn, `Searching ${step}/${maxSteps}...`);
      }
    });

    setButtonLabel(btn, formatResult(result));
  } catch (_) {
    setButtonLabel(btn, 'ERROR');
  } finally {
    isSearching = false;
    btn.disabled = false;
  }
}

/**
 * Yan eylem panelinin içine "Compare Price" ve "Quick Sell" arasına butonu yerleştirir.
 * Kartların kendisi üzerine KESİNLİKLE buton eklemez.
 * @param {Element|object} panelOrView
 * @param {object} [deps]
 */
export function injectRushButtonIntoPanel(panelOrView, deps = {}) {
  const container = panelOrView?.getRootElement?.() || panelOrView?._root || (panelOrView?.nodeType ? panelOrView : null);
  if (!container) return;

  // 1. Kartların kendi elemanları üzerine (liste, pitch vb.) KESİNLİKLE buton ekleme!
  if (typeof container.closest === 'function') {
    if (container.closest('.listFUTItem, .ut-pinned-list-item, .itemList, .ut-pinned-list, .ut-pitch-slot')) {
      return;
    }
  }

  // 2. Action paneldeki "Compare Price" ve "Quick Sell" butonlarını ara
  const { compareBtn, quickSellBtn } = findActionButtons(container);

  // Compare Price veya Quick Sell yoksa bu konteyner doğru yan eylem paneli DEĞİLDİR
  if (!compareBtn && !quickSellBtn) {
    return;
  }

  const targetParent = (compareBtn || quickSellBtn).parentElement;
  if (!targetParent) return;

  // 3. Bu panelde zaten bir RUSH butonu var mı kontrol et (çift buton engelleme)
  let btn = targetParent.querySelector('.' + BTN_CLASS) || container.querySelector('.' + BTN_CLASS);

  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.frInjected = 'true';

    // Tasarım ve font uyumu: Compare Price varsa onun sınıflarını kopyala
    if (compareBtn) {
      btn.className = compareBtn.className + ' ' + BTN_CLASS;
    } else if (quickSellBtn) {
      btn.className = quickSellBtn.className + ' ' + BTN_CLASS;
    } else {
      btn.className = 'btn-standard call-to-action ' + BTN_CLASS;
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'btn-text';
    labelSpan.textContent = IDLE_TEXT;
    btn.appendChild(labelSpan);

    attachButtonEvents(btn, () => handleButtonClick(btn, deps));
  }

  btn.__panelView = panelOrView;

  // Seçili kart değiştiyse butonu sıfırla
  const currentItem = getSelectedItemEntity(panelOrView);
  if (currentItem && btn.__currentDefId !== currentItem.definitionId) {
    btn.__currentDefId = currentItem.definitionId;
    if (!isSearching) {
      setButtonLabel(btn, IDLE_TEXT);
      btn.disabled = false;
    }
  }

  // 4. Tam konumlandırma: "Compare Price" hemen altına, "Quick Sell" hemen üstüne
  if (compareBtn && compareBtn.parentElement === targetParent) {
    if (compareBtn.nextSibling !== btn) {
      compareBtn.insertAdjacentElement('afterend', btn);
    }
  } else if (quickSellBtn && quickSellBtn.parentElement === targetParent) {
    if (quickSellBtn.previousSibling !== btn) {
      quickSellBtn.insertAdjacentElement('beforebegin', btn);
    }
  }

  // 5. Paneldeki olası mükerrer butonları temizle (tek buton garantisi)
  const allInContainer = container.querySelectorAll('.' + BTN_CLASS);
  if (allInContainer.length > 1) {
    allInContainer.forEach((b) => {
      if (b !== btn) b.remove();
    });
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
          if (args[0] && typeof args[0] === 'object') {
            this._rushItem = args[0];
          }
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

  // 1. Kartların üzerindeki olası kaçak butonları temizle
  const rogueButtons = document.querySelectorAll('.listFUTItem .' + BTN_CLASS + ', .itemList .' + BTN_CLASS);
  rogueButtons.forEach((b) => b.remove());

  // 2. Yalnızca sağdaki yan eylem panelini (Detail view) hedefle
  const actionPanels = document.querySelectorAll('.ut-split-view__detail, .ut-item-details-view, .DetailPanel');
  actionPanels.forEach((panel) => {
    try {
      injectRushButtonIntoPanel(panel, deps);
    } catch (_) {}
  });
}

export function resetPatchFlagForTesting() {
  patched = false;
  isSearching = false;
  lastSearchTimeByDefId.clear();
}
