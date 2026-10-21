// Transfer Market arama ekraninda sol fiyat kutucuklari uzerine binen
// %85 opacity koyu tema log/bilgi kutusunu yonetir.
// Bagimliliklar: core/events ve core/state.

import { on } from '../core/events.js';
import { state } from '../core/state.js';

let currentBoxEl = null;
let observer = null;
const MAX_LOGS = 25;
const logHistory = [];

function ensureStyles() {
  if (document.getElementById('fr-market-log-style')) return;
  const st = document.createElement('style');
  st.id = 'fr-market-log-style';
  st.textContent = `
    .ut-market-search-filters-view .search-prices {
      position: relative !important;
    }
    .fr-market-log-box {
      position: absolute;
      top: 30px;
      left: 0;
      width: calc(50% - 6px);
      height: calc(100% - 30px);
      background: rgba(10, 16, 26, 0.85);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(0, 229, 255, 0.25);
      border-radius: 6px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      z-index: 10;
      overflow: hidden;
      font-family: inherit;
      color: #fff;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      transition: opacity 0.15s ease;
    }
    .fr-market-log-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: rgba(0, 229, 255, 0.12);
      border-bottom: 1px solid rgba(0, 229, 255, 0.2);
      font-size: 12px;
      font-weight: 700;
      color: #00e5ff;
      letter-spacing: 0.5px;
      flex: 0 0 auto;
    }
    .fr-market-log-list {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      scrollbar-width: none;
      -ms-overflow-style: none;
      overscroll-behavior: contain;
    }
    .fr-market-log-list::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }
    .fr-market-log-empty {
      font-size: 12px;
      color: #8fa0b5;
      text-align: center;
      margin-top: 24px;
      padding: 0 10px;
      line-height: 1.45;
    }
    .fr-market-log-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 8px;
      min-height: 28px;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.35;
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
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, transform 0.15s;
    }
    .fr-market-log-undo-btn:hover {
      background: rgba(255, 77, 79, 0.3);
      transform: scale(1.1);
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
  const open = isPinnedListOpen();
  currentBoxEl.style.display = open ? 'flex' : 'none';
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

export function mountMarketLogBox() {
  ensureStyles();
  const searchPrices = document.querySelector('.ut-market-search-filters-view .search-prices');
  if (!searchPrices) {
    currentBoxEl = null;
    return;
  }

  let box = searchPrices.querySelector('.fr-market-log-box');
  if (!box) {
    box = document.createElement('div');
    box.className = 'fr-market-log-box';
    searchPrices.appendChild(box);
  }
  currentBoxEl = box;
  setupObserver(searchPrices);
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
  head.innerHTML = '<span>⚡ FutRUSH Log</span><span>Canlı</span>';
  currentBoxEl.appendChild(head);

  const list = document.createElement('div');
  list.className = 'fr-market-log-list';
  list.addEventListener('wheel', (e) => {
    e.stopPropagation();
    list.scrollTop += e.deltaY;
  }, { passive: false });

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
        undoBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          item.undoAction();
          row.remove();
          addMarketLog({ text: `${item.text.replace(' hedeflerden silindi.', '').replace(' silindi.', '')} geri yüklendi.`, type: 'success' });
        });
        row.appendChild(undoBtn);
      }

      list.appendChild(row);
    });
  }

  currentBoxEl.appendChild(list);
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
