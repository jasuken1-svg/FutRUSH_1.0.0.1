// Bot log kayitlarini panelin log sekmesinde goruntuler.
// Filtreleme, panoya kopyalama ve disa aktarma destekler.
// Bagimlilik: core/state.

import { state } from '../../../core/state.js';
import { botLogType, chronologicalBotLogs, logTone, shouldAutoScrollLogList, summarizeBotStats } from '../panelLogic.js';
import { mountWaitBar } from '../waitBar.js';

let activeLogFilter = 'all';

function createLogRow(entry, animate) {
  const row = document.createElement('div');
  row.className = 'fr-log-row' + (animate ? ' fr-log-enter' : '');
  const type = botLogType(entry);
  row.dataset.type = type;
  row.dataset.tone = logTone(type);
  row.dataset.logId = String(entry.id);
  if (type === 'missed' && animate) row.classList.add('fr-log-missed-pulse');

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
  if (entry.kind === 'success' || entry.kind === 'missed') {
    message.appendChild(document.createTextNode(
      String(entry.name) + ' (' + entry.rating + ') ' + Number(entry.price).toLocaleString('tr-TR') + ' '
    ));
    const coin = document.createElement('span');
    coin.className = 'fr-log-coin';
    coin.textContent = '🪙';
    coin.setAttribute('aria-label', 'coin');
    message.append(coin, document.createTextNode(entry.kind === 'success' ? ' ALINDI.' : ' BAŞKASI ALDI.'));
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
  summary.textContent = 'Alınan ' + stats.bought + ' · Kaçırılan ' + stats.missed + ' · Arama ' + stats.searches;
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

function renderLogRows(content, forceBottom = false) {
  const list = content.querySelector('.fr-log-list');
  if (!list) return;
  const wasAtBottom = forceBottom || shouldAutoScrollLogList(list);
  const prevScrollTop = list.scrollTop;
  const entries = chronologicalBotLogs(getFilteredLogs());
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'fr-target-empty';
    empty.textContent = 'Henüz FutRUSH işlem kaydı yok.';
    list.appendChild(empty);
    return;
  }
  entries.forEach((entry) => list.appendChild(createLogRow(entry, false)));
  if (wasAtBottom) {
    list.scrollTop = list.scrollHeight;
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

export function renderBotLogs(content) {
  if (content.querySelector('.fr-logs-view')) {
    updateBotLogStats(content);
    renderLogRows(content);
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
      return `[${time}] ${l.name ? l.name + ' - ' : ''}${l.message || (l.kind === 'success' ? 'ALINDI' : '')}`;
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

  const wasAtBottom = shouldAutoScrollLogList(list);
  const empty = list.querySelector('.fr-target-empty');
  if (empty) empty.remove();
  list.appendChild(createLogRow(entry, true));
  while (list.querySelectorAll('.fr-log-row').length > 100) list.firstElementChild.remove();
  if (wasAtBottom) list.scrollTop = list.scrollHeight;
}
