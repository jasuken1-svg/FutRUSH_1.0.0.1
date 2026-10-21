// Transfer Market arama ekraninda sol fiyat kutucuklari uzerine binen
// %85 opacity koyu tema log/bilgi kutusunu yonetir.
// Bagimliliklar: core/events ve core/state.

let currentBoxEl = null;
const MAX_LOGS = 20;
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
      top: 0;
      left: 0;
      width: calc(50% - 6px);
      height: 100%;
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
    }
    .fr-market-log-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
      background: rgba(0, 229, 255, 0.12);
      border-bottom: 1px solid rgba(0, 229, 255, 0.2);
      font-size: 11px;
      font-weight: 700;
      color: #00e5ff;
      letter-spacing: 0.5px;
    }
    .fr-market-log-list {
      flex: 1;
      overflow-y: auto;
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .fr-market-log-empty {
      font-size: 11px;
      color: #8fa0b5;
      text-align: center;
      margin-top: 18px;
      padding: 0 8px;
      line-height: 1.4;
    }
    .fr-market-log-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 4px 6px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.3;
      color: #e2e8f0;
    }
    .fr-market-log-item.is-undo {
      border-left: 2px solid #ff4d4f;
    }
    .fr-market-log-item.is-success {
      border-left: 2px solid #52c41a;
    }
    .fr-market-log-text {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .fr-market-log-undo-btn {
      background: #ff4d4f;
      color: #fff;
      border: none;
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .fr-market-log-undo-btn:hover {
      background: #ff7875;
    }
  `;
  document.head.appendChild(st);
}

export function addMarketLog({ text, type = 'info', undoAction = null }) {
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
  renderMarketLogBox();
}

export function renderMarketLogBox() {
  if (!currentBoxEl || !currentBoxEl.isConnected) {
    mountMarketLogBox();
    if (!currentBoxEl) return;
  }

  currentBoxEl.replaceChildren();

  const head = document.createElement('div');
  head.className = 'fr-market-log-head';
  head.innerHTML = '<span>⚡ FutRUSH Log</span><span>Canlı</span>';
  currentBoxEl.appendChild(head);

  const list = document.createElement('div');
  list.className = 'fr-market-log-list';

  if (!logHistory.length) {
    const empty = document.createElement('div');
    empty.className = 'fr-market-log-empty';
    empty.textContent = 'Hedef ve işlem bildirimleri burada anlık olarak gösterilir.';
    list.appendChild(empty);
  } else {
    logHistory.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'fr-market-log-item' + (item.undoAction ? ' is-undo' : (item.type === 'success' ? ' is-success' : ''));

      const textSpan = document.createElement('span');
      textSpan.className = 'fr-market-log-text';
      textSpan.textContent = `[${item.time.slice(0, 5)}] ${item.text}`;
      row.appendChild(textSpan);

      if (item.undoAction) {
        const undoBtn = document.createElement('button');
        undoBtn.type = 'button';
        undoBtn.className = 'fr-market-log-undo-btn';
        undoBtn.textContent = 'Geri Al';
        undoBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          item.undoAction();
          row.remove();
          addMarketLog({ text: `${item.text.replace(' silindi.', '')} geri yüklendi.`, type: 'success' });
        });
        row.appendChild(undoBtn);
      }

      list.appendChild(row);
    });
  }

  currentBoxEl.appendChild(list);
  list.scrollTop = list.scrollHeight;
}
