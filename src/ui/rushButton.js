// Kadro, Transfer Listesi ve Kulup kartlarina tek-kart en dusuk piyasa butonu ekler.
// UTItemView / UTItemTableCellView render ve setItemData kancalariyla DOM recycling'e dayanir.

import { CONFIG } from '../core/config.js';
import { findLowestMarketPrice } from '../ea/lowestMarketPrice.js';
import { pageWindow } from '../utils/dom.js';

const RB = CONFIG.rushButton;
const LABEL = RB.label || 'RUSHbuttonv1';
const HOOK_FLAG = '__frRushPatched';
const BTN_KEY = '__frRushBtn';
const ITEM_KEY = '__frRushItem';
const ISOLATE_EVENTS = ['click', 'mousedown', 'touchstart', 'touchend'];
const VIEW_CTORS = ['UTItemView', 'UTItemTableCellView', 'UTPlayerItemView'];

let searchBusy = false;
const patches = [];

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById('fr-rush-btn-style')) return;
  const style = document.createElement('style');
  style.id = 'fr-rush-btn-style';
  style.textContent = `
    .${RB.className} {
      display: none;
      position: absolute;
      left: 50%;
      bottom: 6px;
      transform: translateX(-50%);
      z-index: 30;
      max-width: calc(100% - 8px);
      padding: 3px 7px;
      border: 1px solid rgba(255,255,255,.28);
      border-radius: 4px;
      background: rgba(15, 26, 44, .88);
      color: #e6f6f7;
      font: 600 10px/1.2 Arial, Helvetica, sans-serif;
      letter-spacing: .02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 2px 8px rgba(0,0,0,.45);
    }
    .${RB.className}:hover { background: rgba(0, 229, 255, .22); color: #fff; }
    .${RB.className}.is-busy { opacity: .85; cursor: wait; }
    .${RB.className}.is-error { border-color: rgba(255, 80, 80, .7); }
    .${RB.className}.is-extinct { border-color: rgba(255, 179, 0, .7); }
    .ut-squad-pitch-view .${RB.className},
    .ut-squad-overview .${RB.className},
    .ut-squad-slot-view .${RB.className},
    [class*="squad-slot"] .${RB.className},
    [class*="squad-pitch"] .${RB.className},
    .ut-transfer-list-view .${RB.className},
    [class*="transfer-list"] .${RB.className},
    .ut-club-search-results-view .${RB.className},
    .ut-club-items-view .${RB.className},
    [class*="club-search"] .${RB.className},
    [class*="club-items"] .${RB.className} {
      display: block;
    }
  `;
  document.head.appendChild(style);
}

function viewRoot(view) {
  if (!view) return null;
  try {
    if (typeof view.getRootElement === 'function') {
      const root = view.getRootElement();
      if (root) return root;
    }
  } catch (e) {}
  return view.__root || view._el || view.__el || null;
}

function currentItem(view) {
  if (!view) return null;
  return view.data || view._data || view.item || view[ITEM_KEY] || null;
}

function isPlayerItem(item) {
  if (!item) return false;
  if (typeof item.isPlayer === 'function') {
    try { return !!item.isPlayer(); } catch (e) {}
  }
  const type = typeof item.getSearchType === 'function'
    ? (() => { try { return item.getSearchType(); } catch (e) { return item.type; } })()
    : item.type;
  return !type || type === 'player';
}

function isolate(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function setButtonLabel(btn, text, stateClass) {
  btn.textContent = text;
  btn.classList.remove('is-busy', 'is-error', 'is-extinct');
  if (stateClass) btn.classList.add(stateClass);
}

function bindItemToButton(view) {
  const item = currentItem(view);
  const btn = view[BTN_KEY];
  if (!btn) return;
  const defId = Number(item && item.definitionId) || 0;
  const type = item && (item.type || '') || '';
  const category = item && (item.category || 'any') || 'any';
  const prev = btn.dataset.defId;
  btn.dataset.defId = String(defId);
  btn.dataset.type = type;
  btn.dataset.category = category;
  view[ITEM_KEY] = item;
  if (!isPlayerItem(item) || !defId) {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  if (prev !== String(defId) && !btn.classList.contains('is-busy')) {
    setButtonLabel(btn, LABEL);
  }
}

function itemFromButton(view, btn) {
  const live = currentItem(view);
  if (live && Number(live.definitionId) === Number(btn.dataset.defId)) return live;
  return {
    definitionId: Number(btn.dataset.defId) || 0,
    type: btn.dataset.type || 'player',
    category: btn.dataset.category || 'any'
  };
}

async function onRushClick(view, btn) {
  if (searchBusy || btn.classList.contains('is-busy')) return;
  const item = itemFromButton(view, btn);
  if (!item.definitionId) return;
  searchBusy = true;
  btn.classList.add('is-busy');
  setButtonLabel(btn, 'Searching...', 'is-busy');
  try {
    const result = await findLowestMarketPrice(item, {
      onStep: (step, maxSteps) => {
        if (Number(btn.dataset.defId) !== Number(item.definitionId)) return;
        setButtonLabel(btn, 'Searching ' + step + '/' + maxSteps + '...', 'is-busy');
      }
    });
    if (Number(btn.dataset.defId) !== Number(item.definitionId)) return;
    if (!result.ok) {
      setButtonLabel(btn, 'ERROR', 'is-error');
      return;
    }
    if (result.extinct || !result.slices || result.slices.length === 0) {
      setButtonLabel(btn, 'EXTINCT', 'is-extinct');
      return;
    }
    setButtonLabel(btn, Number(result.price).toLocaleString('tr-TR') + ' ×' + result.count);
  } catch (e) {
    if (Number(btn.dataset.defId) === Number(item.definitionId)) setButtonLabel(btn, 'ERROR', 'is-error');
  } finally {
    searchBusy = false;
    btn.classList.remove('is-busy');
  }
}

function attachRushButton(view) {
  const root = viewRoot(view);
  if (!root || !root.appendChild) return;
  let btn = view[BTN_KEY];
  if (!btn || btn.parentElement !== root) {
    btn = root.querySelector('.' + RB.className);
  }
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = RB.className;
    btn.textContent = LABEL;
    btn.setAttribute('aria-label', LABEL);
    ISOLATE_EVENTS.forEach((name) => {
      btn.addEventListener(name, (event) => {
        isolate(event);
        if (name === 'click') onRushClick(view, btn);
      }, true);
    });
    if (typeof root.style === 'object' && root.style && !root.style.position) {
      root.style.position = 'relative';
    }
    root.appendChild(btn);
  }
  view[BTN_KEY] = btn;
  bindItemToButton(view);
}

function afterViewUpdate(view) {
  attachRushButton(view);
}

function patchMethod(proto, name) {
  const original = proto[name];
  if (typeof original !== 'function') return;
  proto[name] = function patchedRushViewMethod(...args) {
    const result = original.apply(this, args);
    try { afterViewUpdate(this); } catch (e) {}
    return result;
  };
  patches.push({ proto, name, original });
}

function hookConstructor(Ctor) {
  if (!Ctor || !Ctor.prototype || Ctor.prototype[HOOK_FLAG]) return;
  Ctor.prototype[HOOK_FLAG] = true;
  patchMethod(Ctor.prototype, 'render');
  patchMethod(Ctor.prototype, 'setItemData');
}

export function hookRushItemViews() {
  VIEW_CTORS.forEach((name) => hookConstructor(pageWindow[name]));
}

export function initRushButton() {
  ensureStyles();
  hookRushItemViews();
}

export function syncRushButton() {
  hookRushItemViews();
}

export function destroyRushButton() {
  patches.splice(0).forEach(({ proto, name, original }) => {
    proto[name] = original;
    try { delete proto[HOOK_FLAG]; } catch (e) { proto[HOOK_FLAG] = false; }
  });
  searchBusy = false;
}
