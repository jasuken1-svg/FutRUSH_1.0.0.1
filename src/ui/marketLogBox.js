// Transfer Market ve FutRUSH ekranlarinda Genel Log kutusunu yonetir.
// Bagimliliklar: core/events ve core/state.

import { on } from '../core/events.js';
import { state } from '../core/state.js';
import { bindPriceStepRounding } from '../ea/priceSteps.js';

let currentBoxEl = null;
let currentListEl = null;
let observer = null;
let isOpenFloating = false;
const MAX_LOGS = 25;
const logHistory = [];

function ensureStyles() {
  if (document.getElementById('fr-market-log-style')) return;
  const st = document.createElement('style');
  st.id = 'fr-market-log-style';
  st.textContent = `
    .ut-market-search-filters-view .search-prices {
      position: relative !important;
      overflow: visible !important;
    }
    .fr-market-log-box {
      position: fixed;
      top: 65px;
      right: 24px;
      width: 420px;
      min-width: 260px;
      max-width: 90vw;
      height: 218px;
      min-height: 80px;
      max-height: 85vh;
      background: rgba(21, 29, 41, 0.7);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 6px !important;
      box-sizing: border-box;
      display: none;
      flex-direction: column;
      z-index: 99999 !important;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #e6f6f7;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      transition: opacity 0.15s ease;
      pointer-events: auto !important;
      user-select: none;
      padding: 10px;
    }
    .fr-market-log-box * {
      box-sizing: border-box;
    }
    .fr-market-log-box .fr-logs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      flex: 0 0 auto;
    }
    .fr-market-log-box .fr-logs-header-title {
      font-size: 11px;
      font-weight: 700;
      color: #00e5ff;
      letter-spacing: 0.5px;
    }
    .fr-market-log-list {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 4px 1px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      scrollbar-width: none;
      -ms-overflow-style: none;
      overscroll-behavior: contain;
      pointer-events: auto !important;
      cursor: default;
    }
    .fr-market-log-list::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    .fr-market-log-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 100px;
      text-align: center;
      color: #8fa0b5;
      padding: 10px;
      margin: auto 0;
      line-height: 1.5;
      user-select: none;
    }
    .fr-market-log-empty-sub {
      font-size: 10px;
      color: #8fa0b5;
    }
    .fr-market-log-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 2px 6px;
      min-height: 20px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      font-size: 10px;
      line-height: 1.25;
      color: #e2e8f0;
      flex: 0 0 auto;
      user-select: text;
      cursor: default;
    }
    .fr-market-log-item.is-success {
      border-left: 2px solid #52c41a;
    }
    .fr-market-log-item.is-error {
      border-left: 2px solid #ff4d4f;
    }
    .fr-market-log-text {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;
  document.head.appendChild(st);
}

function isPinnedListOpen() {
  const plist = document.querySelector('.ut-market-search-filters-view .ut-pinned-list, .ut-pinned-list');
  if (!plist) return false;
  if (plist.offsetParent === null || plist.hidden) return false;
  const style = window.getComputedStyle(plist);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  if (plist.offsetHeight <= 5 && plist.offsetWidth <= 5) return false;
  const hasPlayer = plist.querySelector('.listFUTItem, .ut-pinned-list-item, [class*="player"]') !== null || plist.children.length > 0;
  return hasPlayer;
}

export function syncMarketLogVisibility() {
  if (!currentBoxEl) return;
  if (!isOpenFloating) {
    currentBoxEl.style.display = 'none';
    return;
  }
  const inSearchPrices = currentBoxEl.closest && currentBoxEl.closest('.search-prices');
  if (inSearchPrices) {
    const open = isPinnedListOpen();
    currentBoxEl.style.display = open ? 'flex' : 'none';
  } else {
    currentBoxEl.style.display = isOpenFloating ? 'flex' : 'none';
  }
}

export function openMarketLogBox() {
  isOpenFloating = true;
  if (!currentBoxEl || !currentBoxEl.isConnected) {
    mountMarketLogBox();
  }
  if (currentBoxEl) {
    currentBoxEl.style.display = 'flex';
  }
}

export function closeMarketLogBox() {
  isOpenFloating = false;
  if (currentBoxEl) {
    currentBoxEl.style.display = 'none';
  }
}

export function toggleMarketLogBox(force) {
  const next = typeof force === 'boolean' ? force : !isOpenFloating;
  if (next) {
    openMarketLogBox();
  } else {
    closeMarketLogBox();
  }
  return isOpenFloating;
}

function setupObserver(searchPrices) {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  const scope = searchPrices.closest('.ut-market-search-filters-view') || searchPrices.parentElement;
  if (!scope) return;
  observer = new MutationObserver(() => {
    syncMarketLogVisibility();
  });
  observer.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
}

export function addMarketLog({ text, type = 'info', undoAction = null }) {
  if (!text) return;
  const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = { text, type, time, undoAction, id: Date.now() + Math.random() };
  logHistory.push(entry);
  if (logHistory.length > MAX_LOGS) {
    logHistory.shift();
  }
  renderMarketLogBox();
}

export function mountMarketLogBox(targetContainer) {
  ensureStyles();
  const searchPrices = document.querySelector('.ut-market-search-filters-view .search-prices');
  if (searchPrices) {
    searchPrices.querySelectorAll('input').forEach((input) => {
      if (input.dataset.frBoundPrice) return;
      input.dataset.frBoundPrice = 'true';
      bindPriceStepRounding(input);
    });
    setupObserver(searchPrices);
  }

  if (targetContainer) {
    let box = targetContainer.querySelector('.fr-market-log-box') || currentBoxEl || document.querySelector('.fr-market-log-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'fr-market-log-box';
    }
    if (box.parentElement !== targetContainer) {
      targetContainer.appendChild(box);
    }
    currentBoxEl = box;
    setupBoxElements(box);
    renderMarketLogBox();
    return;
  }

  if (!currentBoxEl || !currentBoxEl.isConnected) {
    let box = document.querySelector('.fr-market-log-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'fr-market-log-box';
      document.body.appendChild(box);
    }
    currentBoxEl = box;
    setupBoxElements(box);
  }

  renderMarketLogBox();
}

function setupBoxElements(box) {
  if (box.dataset.frSetup) return;
  box.dataset.frSetup = 'true';

  // Panel Başlığı: "Genel Loglar" (Loglar paneli ile birebir aynı stil)
  let header = box.querySelector('.fr-logs-header');
  if (!header) {
    header = document.createElement('div');
    header.className = 'fr-logs-header';
    header.innerHTML = '<span class="fr-logs-header-title">Genel Loglar</span>';
    box.appendChild(header);
  }

  // Liste taşıyıcı (Scrollbar gizli, yerel kaydırma aktif)
  let list = box.querySelector('.fr-market-log-list');
  if (!list) {
    list = document.createElement('div');
    list.className = 'fr-market-log-list fr-log-list';
    box.appendChild(list);
  }
  currentListEl = list;
}

export function renderMarketLogBox(forceBottom = false) {
  if (!currentBoxEl || !currentBoxEl.isConnected) {
    mountMarketLogBox();
    if (!currentBoxEl) return;
  }

  setupBoxElements(currentBoxEl);
  syncMarketLogVisibility();

  const list = currentListEl || currentBoxEl.querySelector('.fr-market-log-list');
  if (!list) return;

  const wasAtBottom = forceBottom || (list.scrollHeight - list.scrollTop - list.clientHeight <= 35);
  const prevScrollTop = list.scrollTop;

  list.replaceChildren();

  if (!logHistory.length) {
    const empty = document.createElement('div');
    empty.className = 'fr-market-log-empty';
    empty.innerHTML = '<span class="fr-market-log-empty-sub">Hedef ve işlem bildirimleri burada anlık olarak gösterilir.</span>';
    list.appendChild(empty);
  } else {
    logHistory.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'fr-market-log-item' +
        (item.type === 'success' ? ' is-success' : (item.type === 'error' ? ' is-error' : ''));

      const textSpan = document.createElement('span');
      textSpan.className = 'fr-market-log-text';
      textSpan.textContent = `[${item.time.slice(0, 5)}] ${item.text}`;
      row.appendChild(textSpan);

      list.appendChild(row);
    });
  }

  if (wasAtBottom) {
    list.scrollTop = list.scrollHeight;
  } else {
    list.scrollTop = prevScrollTop;
  }
}

// Target tab log veya info bildirimlerini otomatik log kutusuna aktar
on('targets:status', () => {
  if (state.targetStatus?.message) {
    addMarketLog({
      text: state.targetStatus.message,
      type: state.targetStatus.type || 'info'
    });
  }
});
