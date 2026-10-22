// Transfer Market ve FutRUSH ekranlarinda kaydirilabilir, 4 kosesinden boyutlandirilabilir
// duz koseli Genel Log kutusunu yonetir.
// Bagimliliklar: core/events ve core/state.

import { on } from '../core/events.js';
import { state } from '../core/state.js';
import { bindPriceStepRounding } from '../ea/priceSteps.js';

let currentBoxEl = null;
let currentListEl = null;
let observer = null;
let isOpenFloating = false;
let isEventsBound = false;
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
      background: rgba(10, 16, 26, 0.95);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(0, 229, 255, 0.35);
      border-radius: 6px !important;
      box-sizing: border-box;
      display: none;
      flex-direction: column;
      z-index: 99999 !important;
      overflow: hidden;
      font-family: inherit;
      color: #fff;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      transition: opacity 0.15s ease;
      pointer-events: auto !important;
      user-select: none;
    }
    .fr-market-log-box * {
      box-sizing: border-box;
    }
    .fr-market-log-close-btn {
      position: absolute;
      top: 4px;
      right: 6px;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 0 !important;
      color: #8fa0b5;
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      z-index: 30;
      transition: background 0.15s, color 0.15s;
    }
    .fr-market-log-close-btn:hover {
      background: rgba(255, 77, 79, 0.35);
      border-color: #ff4d4f;
      color: #fff;
    }
    .fr-market-log-list {
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 6px 8px;
      padding-right: 28px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 229, 255, 0.3) transparent;
      overscroll-behavior: contain;
      pointer-events: auto !important;
      cursor: move;
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
    .fr-market-log-empty-title {
      font-size: 13px;
      font-weight: 700;
      color: #00e5ff;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }
    .fr-market-log-empty-sub {
      font-size: 11px;
      color: #8fa0b5;
    }
    .fr-market-log-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 3px 6px;
      min-height: 22px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 0 !important;
      font-size: 11px;
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

    /* 4 Köşe Görünmez Boyutlandırma Tutamaçları */
    .fr-log-resize-corner {
      position: absolute;
      width: 14px;
      height: 14px;
      z-index: 25;
      background: transparent !important;
      border: none !important;
      opacity: 0 !important;
    }
    .fr-log-resize-corner.fr-corner-tl {
      top: 0;
      left: 0;
      cursor: nwse-resize;
    }
    .fr-log-resize-corner.fr-corner-tr {
      top: 0;
      right: 0;
      cursor: nesw-resize;
    }
    .fr-log-resize-corner.fr-corner-bl {
      bottom: 0;
      left: 0;
      cursor: nesw-resize;
    }
    .fr-log-resize-corner.fr-corner-br {
      bottom: 0;
      right: 0;
      cursor: nwse-resize;
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
  const logBtn = document.querySelector('.fr-header-log-btn');
  if (logBtn) logBtn.classList.add('fr-active');
}

export function closeMarketLogBox() {
  isOpenFloating = false;
  if (currentBoxEl) {
    currentBoxEl.style.display = 'none';
  }
  const logBtn = document.querySelector('.fr-header-log-btn');
  if (logBtn) logBtn.classList.remove('fr-active');
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

function makeDraggable(box) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initLeft = 0;
  let initTop = 0;

  box.addEventListener('mousedown', (e) => {
    // Butonlara veya köşe tutamaçlarına tıklandığında taşıma yapma
    if (e.target.closest('button, .fr-log-resize-corner, .fr-market-log-undo-btn')) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const r = box.getBoundingClientRect();
    initLeft = r.left;
    initTop = r.top;
    box.classList.add('fr-dragged');

    box.style.left = initLeft + 'px';
    box.style.top = initTop + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';

    const onMove = (ev) => {
      if (!isDragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const maxL = Math.max(0, window.innerWidth - box.offsetWidth);
      const maxT = Math.max(0, window.innerHeight - box.offsetHeight);
      box.style.left = Math.max(0, Math.min(maxL, initLeft + dx)) + 'px';
      box.style.top = Math.max(0, Math.min(maxT, initTop + dy)) + 'px';
    };

    const onUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function makeCornerResizable(box, cornerEl, direction) {
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;
  let initLeft = 0;
  let initTop = 0;

  cornerEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = box.offsetWidth;
    startH = box.offsetHeight;
    const r = box.getBoundingClientRect();
    initLeft = r.left;
    initTop = r.top;
    box.classList.add('fr-dragged');

    box.style.left = initLeft + 'px';
    box.style.top = initTop + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';

    const onMove = (ev) => {
      if (!isResizing) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const minW = 260;
      const minH = 80;

      if (direction === 'br') {
        const newW = Math.max(minW, Math.min(window.innerWidth - initLeft, startW + dx));
        const newH = Math.max(minH, Math.min(window.innerHeight - initTop, startH + dy));
        box.style.width = newW + 'px';
        box.style.height = newH + 'px';
      } else if (direction === 'bl') {
        const newW = Math.max(minW, startW - dx);
        const newH = Math.max(minH, Math.min(window.innerHeight - initTop, startH + dy));
        if (newW !== minW || dx < 0) {
          box.style.left = Math.max(0, initLeft + dx) + 'px';
          box.style.width = newW + 'px';
        }
        box.style.height = newH + 'px';
      } else if (direction === 'tr') {
        const newW = Math.max(minW, Math.min(window.innerWidth - initLeft, startW + dx));
        const newH = Math.max(minH, startH - dy);
        if (newH !== minH || dy < 0) {
          box.style.top = Math.max(0, initTop + dy) + 'px';
          box.style.height = newH + 'px';
        }
        box.style.width = newW + 'px';
      } else if (direction === 'tl') {
        const newW = Math.max(minW, startW - dx);
        const newH = Math.max(minH, startH - dy);
        if (newW !== minW || dx < 0) {
          box.style.left = Math.max(0, initLeft + dx) + 'px';
          box.style.width = newW + 'px';
        }
        if (newH !== minH || dy < 0) {
          box.style.top = Math.max(0, initTop + dy) + 'px';
          box.style.height = newH + 'px';
        }
      }
    };

    const onUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
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

  // Kapat butonu
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'fr-market-log-close-btn';
  closeBtn.title = 'Kapat';
  closeBtn.setAttribute('aria-label', 'Kapat');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMarketLogBox();
  });
  box.appendChild(closeBtn);

  // 4 Köşe görünmez boyutlandırma tutamaçları
  const corners = [
    { dir: 'tl', cls: 'fr-corner-tl' },
    { dir: 'tr', cls: 'fr-corner-tr' },
    { dir: 'bl', cls: 'fr-corner-bl' },
    { dir: 'br', cls: 'fr-corner-br' }
  ];
  corners.forEach(({ dir, cls }) => {
    const c = document.createElement('div');
    c.className = `fr-log-resize-corner ${cls}`;
    box.appendChild(c);
    makeCornerResizable(box, c, dir);
  });

  // Liste taşıyıcı
  let list = box.querySelector('.fr-market-log-list');
  if (!list) {
    list = document.createElement('div');
    list.className = 'fr-market-log-list fr-log-list';
    list.addEventListener('wheel', (e) => {
      e.stopPropagation();
      list.scrollTop += e.deltaY;
    }, { passive: true });
    box.appendChild(list);
  }
  currentListEl = list;

  if (!isEventsBound) {
    makeDraggable(box);
    isEventsBound = true;
  }
}

export function renderMarketLogBox() {
  if (!currentBoxEl || !currentBoxEl.isConnected) {
    mountMarketLogBox();
    if (!currentBoxEl) return;
  }

  setupBoxElements(currentBoxEl);
  syncMarketLogVisibility();

  const list = currentListEl || currentBoxEl.querySelector('.fr-market-log-list');
  if (!list) return;

  list.replaceChildren();

  if (!logHistory.length) {
    const empty = document.createElement('div');
    empty.className = 'fr-market-log-empty';
    empty.innerHTML =
      '<span class="fr-market-log-empty-title">Genel Log Listesi</span>' +
      '<span class="fr-market-log-empty-sub">Hedef ve işlem bildirimleri burada anlık olarak gösterilir.</span>';
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

  list.scrollTop = list.scrollHeight;
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
