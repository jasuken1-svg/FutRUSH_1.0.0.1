// Transfer Market ve FutRUSH ekranlarinda kaydirilabilir ve boyutu ayarlanabilir
// Genel Log penceresini yonetir.
// Bagimliliklar: core/events ve core/state.

import { on } from '../core/events.js';
import { state } from '../core/state.js';
import { bindPriceStepRounding } from '../ea/priceSteps.js';

let currentBoxEl = null;
let observer = null;
let isOpenFloating = false;
let isInitializedDraggable = false;
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
      height: 180px;
      min-height: 80px;
      max-height: 85vh;
      background: rgba(10, 16, 26, 0.94);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(0, 229, 255, 0.35);
      border-radius: 8px;
      box-sizing: border-box;
      display: none;
      flex-direction: column;
      z-index: 99999 !important;
      overflow: hidden;
      font-family: inherit;
      color: #fff;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.65);
      transition: opacity 0.15s ease;
      pointer-events: auto !important;
      resize: both;
    }
    .fr-market-log-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: rgba(0, 229, 255, 0.15);
      border-bottom: 1px solid rgba(0, 229, 255, 0.25);
      font-size: 12px;
      font-weight: 700;
      color: #00e5ff;
      letter-spacing: 0.5px;
      flex: 0 0 auto;
      line-height: 1.2;
      user-select: none;
      cursor: move;
    }
    .fr-market-log-head-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .fr-market-log-live-badge {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 3px;
      background: rgba(0, 229, 255, 0.2);
      border: 1px solid rgba(0, 229, 255, 0.4);
      color: #00e5ff;
    }
    .fr-market-log-close-btn {
      background: transparent;
      border: 0;
      color: #8fa0b5;
      font-size: 12px;
      cursor: pointer;
      padding: 2px 5px;
      line-height: 1;
      border-radius: 3px;
    }
    .fr-market-log-close-btn:hover {
      background: rgba(255, 77, 79, 0.2);
      color: #ff4d4f;
    }
    .fr-market-log-list {
      flex: 1 1 auto;
      min-height: 0;
      max-height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 4px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 229, 255, 0.3) transparent;
      overscroll-behavior: contain;
      pointer-events: auto !important;
    }
    .fr-market-log-empty {
      font-size: 11px;
      color: #8fa0b5;
      text-align: center;
      margin-top: 14px;
      padding: 0 8px;
      line-height: 1.35;
    }
    .fr-market-log-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 3px 6px;
      min-height: 22px;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.25;
      color: #e2e8f0;
      flex: 0 0 auto;
    }
    .fr-market-log-item.is-undo {
      border-left: 2px solid #ff4d4f;
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
    .fr-market-log-undo-btn {
      background: rgba(255, 77, 79, 0.15);
      color: #ff4d4f;
      border: 1px solid rgba(255, 77, 79, 0.6);
      border-radius: 3px;
      padding: 1px 4px;
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, transform 0.15s;
      pointer-events: auto !important;
    }
    .fr-market-log-undo-btn:hover {
      background: rgba(255, 77, 79, 0.3);
      transform: scale(1.08);
    }
    .fr-log-resize-handle {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 18px;
      height: 18px;
      cursor: se-resize;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .fr-log-resize-handle::after {
      content: '';
      position: absolute;
      right: 3px;
      bottom: 3px;
      width: 8px;
      height: 8px;
      border-right: 2px solid #00e5ff;
      border-bottom: 2px solid #00e5ff;
      opacity: 0.8;
      transition: opacity 0.15s, border-color 0.15s;
    }
    .fr-log-resize-handle:hover::after {
      opacity: 1;
      border-color: #fff;
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
  if (isOpenFloating) {
    currentBoxEl.style.display = 'flex';
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

function makeDraggable(box, handle) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initLeft = 0;
  let initTop = 0;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const r = box.getBoundingClientRect();
    initLeft = r.left;
    initTop = r.top;
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

function makeResizable(box, grip) {
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;

  grip.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = box.offsetWidth;
    startH = box.offsetHeight;

    const onMove = (ev) => {
      if (!isResizing) return;
      const dw = ev.clientX - startX;
      const dh = ev.clientY - startY;
      const newW = Math.max(260, Math.min(window.innerWidth - (box.offsetLeft || 0), startW + dw));
      const newH = Math.max(80, Math.min(window.innerHeight - (box.offsetTop || 0), startH + dh));
      box.style.width = newW + 'px';
      box.style.height = newH + 'px';
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
    let box = targetContainer.querySelector('.fr-market-log-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'fr-market-log-box';
      targetContainer.appendChild(box);
    }
    currentBoxEl = box;
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
  }

  renderMarketLogBox();
}

export function renderMarketLogBox() {
  if (!currentBoxEl || !currentBoxEl.isConnected) {
    mountMarketLogBox();
    if (!currentBoxEl) return;
  }

  syncMarketLogVisibility();
  currentBoxEl.replaceChildren();

  const head = document.createElement('div');
  head.className = 'fr-market-log-head';
  head.innerHTML =
    '<span>⚡ Genel Log</span>' +
    '<div class="fr-market-log-head-actions">' +
      '<span class="fr-market-log-live-badge">Canlı</span>' +
      '<button type="button" class="fr-market-log-close-btn" title="Kapat" aria-label="Kapat">✕</button>' +
    '</div>';
  head.querySelector('.fr-market-log-close-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMarketLogBox();
  });
  currentBoxEl.appendChild(head);

  const list = document.createElement('div');
  list.className = 'fr-market-log-list';
  list.addEventListener('wheel', (e) => {
    e.stopPropagation();
    list.scrollTop += e.deltaY;
  }, { passive: true });

  if (!logHistory.length) {
    const empty = document.createElement('div');
    empty.className = 'fr-market-log-empty';
    empty.textContent = 'Hedef ve işlem bildirimleri burada anlık olarak gösterilir.';
    list.appendChild(empty);
  } else {
    logHistory.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'fr-market-log-item' +
        (item.undoAction ? ' is-undo' : (item.type === 'success' ? ' is-success' : (item.type === 'error' ? ' is-error' : '')));

      const textSpan = document.createElement('span');
      textSpan.className = 'fr-market-log-text';
      textSpan.textContent = `[${item.time.slice(0, 5)}] ${item.text}`;
      row.appendChild(textSpan);

      if (item.undoAction) {
        const undoBtn = document.createElement('button');
        undoBtn.type = 'button';
        undoBtn.className = 'fr-market-log-undo-btn';
        undoBtn.textContent = '↩️';
        undoBtn.title = 'Geri Al';
        undoBtn.setAttribute('aria-label', 'Geri Al');
        const triggerUndo = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof item.undoAction === 'function') {
            const action = item.undoAction;
            item.undoAction = null;
            const idx = logHistory.indexOf(item);
            if (idx !== -1) logHistory.splice(idx, 1);
            action();
            addMarketLog({ text: `${item.text.replace(' hedeflerden silindi.', '').replace(' silindi.', '')} geri yüklendi.`, type: 'success' });
          }
        };
        undoBtn.addEventListener('click', triggerUndo);
        undoBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
        row.appendChild(undoBtn);
      }

      list.appendChild(row);
    });
  }

  currentBoxEl.appendChild(list);

  // Resize grip handle at bottom-right
  const resizeGrip = document.createElement('div');
  resizeGrip.className = 'fr-log-resize-handle';
  resizeGrip.title = 'Sağ alttan tutarak genişlik ve boyutu ayarlayın';
  resizeGrip.setAttribute('aria-label', 'Boyutu ayarla');
  currentBoxEl.appendChild(resizeGrip);

  if (!isInitializedDraggable) {
    makeDraggable(currentBoxEl, head);
    makeResizable(currentBoxEl, resizeGrip);
    isInitializedDraggable = true;
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
