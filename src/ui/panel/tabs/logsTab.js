// Bot log kayitlarini panelin log sekmesinde goruntuler.
// Filtreleme, panoya kopyalama ve disa aktarma destekler.
// Bagimlilik: core/state, core/events.

import { state } from '../../../core/state.js';
import { on } from '../../../core/events.js';
import { botLogType, logTone, summarizeBotStats } from '../panelLogic.js';
import { mountWaitBar } from '../waitBar.js';
import { addBotLog } from '../../../bot/botLog.js';

let activeLogFilter = 'all';
let activeWaitRow = null;
let activeWaitTicker = null;
let waitEventsRegistered = false;

function createLogRow(entry, animate) {
  const row = document.createElement('div');
  const isWait = entry.kind === 'wait';
  row.className = 'fr-log-row' + (animate ? ' fr-log-enter' : '');
  if (isWait) {
    row.classList.add('log-wait', 'is-done');
    if (entry.tierColor) row.style.setProperty('--tier', entry.tierColor);
  }

  const type = botLogType(entry);
  row.dataset.type = type;
  row.dataset.tone = logTone(type);
  row.dataset.logId = String(entry.id);

  if (entry.kind === 'success') {
    row.classList.add('log-fx-success');
    if (animate) {
      row.classList.add('log-fx-new');
      setTimeout(() => row.classList.remove('log-fx-new'), 8000);
    }
  } else if (entry.kind === 'missed') {
    row.classList.add('log-fx-lost');
    if (animate) {
      row.classList.add('log-fx-new', 'fr-log-missed-pulse');
      setTimeout(() => row.classList.remove('log-fx-new'), 8000);
    }
  }

  const time = document.createElement('time');
  time.className = 'fr-log-time';
  time.dateTime = new Date(entry.at).toISOString();
  time.textContent = new Date(entry.at).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const message = document.createElement('span');
  message.className = 'fr-log-message';

  if (entry.kind === 'wait') {
    message.textContent = entry.message || '';
  } else if (entry.kind === 'success' || entry.kind === 'missed' || entry.kind === 'dryRun') {
    if (entry.kind === 'dryRun') {
      message.appendChild(document.createTextNode(
        'KURU ÇALIŞTIRMA: ' + String(entry.name) + ' (' + entry.rating + ') ' + Number(entry.price).toLocaleString('tr-TR') + ' fiyatından alınırdı'
      ));
      const coin = document.createElement('span');
      coin.className = 'fr-log-coin';
      coin.textContent = ' 🧪';
      coin.setAttribute('aria-label', 'kuru çalıştırma simülasyonu');
      message.appendChild(coin);
    } else {
      message.appendChild(document.createTextNode(
        String(entry.name) + ' (' + entry.rating + ') ' + Number(entry.price).toLocaleString('tr-TR') + ' '
      ));
      const coin = document.createElement('span');
      coin.className = 'fr-log-coin';
      coin.textContent = entry.kind === 'success' ? '😍' : '😡';
      coin.setAttribute('aria-label', entry.kind === 'success' ? 'alındı' : 'başkası aldı');
      if (entry.kind === 'success') {
        const profitVal = Number(entry.totalProfit ?? entry.profit ?? 0);
        const profitFormatted = profitVal !== 0 ? (profitVal > 0 ? '+' : '') + profitVal.toLocaleString('tr-TR') : '0';
        message.append(coin, document.createTextNode(' ALINDI. Toplam kâr ' + profitFormatted));
      } else {
        message.append(coin, document.createTextNode(' BAŞKASI ALDI.'));
      }
    }
  } else {
    message.textContent = entry.message;
  }
  row.append(time, message);
  return row;
}

export function updateBotLogStats(content) {
  const summary = content.querySelector('.fr-log-summary');
  if (!summary) return;
  const stats = summarizeBotStats(state.botStats);
  const simText = stats.simulatedBought > 0 ? ` · Simüle ${stats.simulatedBought}` : '';
  summary.textContent = 'Alınan ' + stats.bought + simText + ' · Kaçırılan ' + stats.missed + ' · Arama ' + stats.searches;
}

function getFilteredLogs() {
  const logs = state.botLogs.slice(0, 100);
  if (activeLogFilter === 'success') {
    return logs.filter((l) => l.kind === 'success');
  }
  if (activeLogFilter === 'error') {
    return logs.filter((l) => l.kind === 'error');
  }
  return logs;
}

function renderLogRows(content, forceTop = false) {
  const list = content.querySelector('.fr-log-list');
  if (!list) return;
  const wasAtTop = forceTop || list.scrollTop <= 15;
  const prevScrollTop = list.scrollTop;
  const entries = getFilteredLogs();
  list.replaceChildren();
  if (!entries.length && !activeWaitRow) {
    const empty = document.createElement('div');
    empty.className = 'fr-target-empty';
    empty.textContent = 'Henüz FutRUSH işlem kaydı yok.';
    list.appendChild(empty);
    return;
  }
  if (activeWaitRow && activeLogFilter === 'all') {
    list.appendChild(activeWaitRow);
  }
  entries.forEach((entry) => list.appendChild(createLogRow(entry, false)));
  if (wasAtTop) {
    list.scrollTop = 0;
  } else {
    list.scrollTop = prevScrollTop;
  }
}

function copyToClipboard(text) {
  if (typeof globalThis.GM_setClipboard === 'function') {
    globalThis.GM_setClipboard(text, 'text');
    return Promise.resolve();
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return fallbackCopy(text);
}

function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    ta.remove();
  } catch {
    // Ignore fallback copy error
  }
  return Promise.resolve();
}

function createLiveWaitElement(wait) {
  const el = document.createElement('div');
  el.className = 'fr-log-row log-wait';
  el.dataset.type = 'wait';
  el.dataset.tone = 'info';
  const tierColor = wait.tierColor || '#38bdf8';
  el.style.setProperty('--tier', tierColor);
  el.style.setProperty('--wait-ms', `${wait.duration}ms`);

  const targetName = wait.nextTargetName || 'Hedefler';
  const jitterText = wait.jitterMs > 0
    ? `${wait.jitterMs} ms jitter`
    : '0 ms (jitter kapalı)';
  const breakdownText = `${wait.baseMs} ms + ${jitterText} = ${wait.duration} ms`;

  el.innerHTML = `
    <div class="log-wait-top">
      <div class="log-wait-left">
        <span aria-hidden="true">⏱</span>
        <span>Sıradaki: <span class="log-wait-target">${targetName}</span></span>
      </div>
      <div class="log-wait-countdown">...</div>
    </div>
    <div class="log-wait-breakdown">${breakdownText}</div>
    <div class="log-wait-bar" aria-hidden="true"></div>
  `;
  return el;
}

function finalizeLiveWait(isCancelled = false) {
  if (activeWaitTicker) {
    clearInterval(activeWaitTicker);
    activeWaitTicker = null;
  }
  if (!activeWaitRow) return;

  const row = activeWaitRow;
  activeWaitRow = null;

  const wait = row._waitData;
  if (!wait) {
    row.remove();
    return;
  }

  const cancelNotice = isCancelled ? ' (iptal edildi)' : '';
  const logMessage = `⏱ Bekleme ${wait.baseMs} + ${wait.jitterMs} = ${wait.duration} ms · ${wait.nextTargetName || 'Hedefler'}${cancelNotice}`;

  // Statik log kaydina donustur
  addBotLog({
    kind: 'wait',
    message: logMessage,
    tierColor: wait.tierColor,
    baseMs: wait.baseMs,
    jitterMs: wait.jitterMs,
    targetName: wait.nextTargetName
  });

  row.remove();
}

function handleLiveWaitUpdate() {
  const wait = state.botWait;
  const logLists = document.querySelectorAll('.fr-log-list');

  if (!wait || !state.botRunning || wait.duration <= 0) {
    if (activeWaitRow) {
      finalizeLiveWait(!state.botRunning);
    }
    return;
  }

  // Eger hali hazirda bir canli bekleme satiri varsa ve ayni bekleme ise sadece ticker calisir
  if (activeWaitRow && activeWaitRow._waitData?.start === wait.start) {
    return;
  }

  // Onceki varsa kapat
  if (activeWaitRow) {
    finalizeLiveWait(false);
  }

  // Yeni canli bekleme satiri olustur
  activeWaitRow = createLiveWaitElement(wait);
  activeWaitRow._waitData = wait;

  const countdownEl = activeWaitRow.querySelector('.log-wait-countdown');
  const updateCountdown = () => {
    if (!activeWaitRow || !countdownEl) return;
    const remainingMs = Math.max(0, wait.duration - (Date.now() - wait.start));
    countdownEl.textContent = (remainingMs / 1000).toFixed(1) + ' sn';
    if (remainingMs <= 0 || !state.botRunning) {
      finalizeLiveWait(!state.botRunning);
    }
  };
  updateCountdown();
  activeWaitTicker = setInterval(updateCountdown, 100);

  // Tum acik log listelerine ekle
  logLists.forEach((list) => {
    if (activeLogFilter === 'all') {
      const empty = list.querySelector('.fr-target-empty');
      if (empty) empty.remove();
      list.prepend(activeWaitRow);
    }
  });
}

function ensureWaitEvents() {
  if (waitEventsRegistered) return;
  waitEventsRegistered = true;
  on('bot:wait', handleLiveWaitUpdate);
}

export function renderBotLogs(content) {
  ensureWaitEvents();
  if (content.querySelector('.fr-logs-view')) {
    updateBotLogStats(content);
    return;
  }

  content.innerHTML =
    '<div class="fr-logs-view">' +
      '<div class="fr-logs-header">' +
        '<span class="fr-logs-header-title">Loglar</span>' +
        '<div class="fr-log-summary"></div>' +
      '</div>' +
      '<div class="fr-waitbar" hidden></div>' +
      '<div class="fr-log-toolbar">' +
        '<div class="fr-log-filters">' +
          '<button class="fr-log-filter-btn' + (activeLogFilter === 'all' ? ' active' : '') + '" data-filter="all" type="button">Tümü</button>' +
          '<button class="fr-log-filter-btn' + (activeLogFilter === 'success' ? ' active' : '') + '" data-filter="success" type="button">Başarı</button>' +
          '<button class="fr-log-filter-btn' + (activeLogFilter === 'error' ? ' active' : '') + '" data-filter="error" type="button">Hata</button>' +
        '</div>' +
        '<div class="fr-log-actions">' +
          '<button class="fr-log-btn fr-log-copy" type="button">Kopyala</button>' +
          '<button class="fr-log-btn fr-log-export" type="button">Dışa Aktar</button>' +
          '<button class="fr-log-clear" type="button">Temizle</button>' +
        '</div>' +
      '</div>' +
      '<div class="fr-log-list" role="log" aria-live="polite"></div>' +
    '</div>';

  content.querySelectorAll('.fr-log-filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      content.querySelectorAll('.fr-log-filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeLogFilter = btn.dataset.filter;
      renderLogRows(content, true);
    });
  });

  const copyBtn = content.querySelector('.fr-log-copy');
  copyBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const lines = getFilteredLogs().map((l) => {
      const time = new Date(l.at).toLocaleTimeString('tr-TR');
      if (l.kind === 'wait') {
        return `[${time}] ${l.message || ''}`;
      }
      if (l.kind === 'success') {
        const profitVal = Number(l.totalProfit ?? l.profit ?? 0);
        const profitFormatted = profitVal !== 0 ? (profitVal > 0 ? '+' : '') + profitVal.toLocaleString('tr-TR') : '0';
        return `[${time}] ${l.name} (${l.rating}) ${Number(l.price).toLocaleString('tr-TR')} 😍 ALINDI. Toplam kâr ${profitFormatted}`;
      }
      if (l.kind === 'missed') {
        return `[${time}] ${l.name} (${l.rating}) ${Number(l.price).toLocaleString('tr-TR')} 😡 BAŞKASI ALDI.`;
      }
      if (l.kind === 'dryRun') {
        return `[${time}] KURU ÇALIŞTIRMA: ${l.name} (${l.rating}) ${Number(l.price).toLocaleString('tr-TR')} fiyatından alınırdı`;
      }
      return `[${time}] ${l.name ? l.name + ' - ' : ''}${l.message || ''}`;
    });
    copyToClipboard(lines.join('\n')).then(() => {
      const orig = copyBtn.textContent;
      copyBtn.textContent = 'Kopyalandı!';
      setTimeout(() => { copyBtn.textContent = orig; }, 1500);
    });
  });

  const exportBtn = content.querySelector('.fr-log-export');
  exportBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const data = JSON.stringify(getFilteredLogs(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `futrush-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 100);
  });

  const clearBtn = content.querySelector('.fr-log-clear');
  clearBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.botLogs.length = 0;
    renderLogRows(content, true);
  });

  updateBotLogStats(content);
  renderLogRows(content, true);
  mountWaitBar(content.querySelector('.fr-waitbar'));
}

export function addBotLogEntry(content) {
  const list = content.querySelector('.fr-log-list');
  if (!list) return;
  const entry = state.botLogs[0];
  if (!entry || list.querySelector('[data-log-id="' + entry.id + '"]')) return;
  if (activeLogFilter === 'success' && entry.kind !== 'success') return;
  if (activeLogFilter === 'error' && entry.kind !== 'error') return;

  const wasAtTop = list.scrollTop <= 15;
  const empty = list.querySelector('.fr-target-empty');
  if (empty) empty.remove();

  const newRow = createLogRow(entry, true);
  if (activeWaitRow && list.contains(activeWaitRow)) {
    activeWaitRow.after(newRow);
  } else {
    list.prepend(newRow);
  }

  while (list.querySelectorAll('.fr-log-row').length > 100) list.lastElementChild.remove();
  if (wasAtTop) list.scrollTop = 0;
}
