// Bot log kayitlarini panelin log sekmesinde goruntuler.
// Bagimlilik: core/state.

import { state } from '../../../core/state.js';
import { filterBotLogs, summarizeBotStats } from '../panelLogic.js';
import { mountWaitBar } from '../waitBar.js';

const LOG_FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'purchases', label: 'Alımlar' },
  { id: 'issues', label: 'Sorunlar' }
];

function logTypeLabel(type) {
  if (type === 'success') return 'Alındı';
  if (type === 'missed') return 'Kaçırıldı';
  if (type === 'error') return 'Hata';
  if (type === 'warn') return 'Uyarı';
  return 'Bilgi';
}

function createLogRow(entry, animate) {
  const row = document.createElement('div');
  row.className = 'fr-log-row' + (animate ? ' fr-log-enter' : '');
  row.dataset.type = entry.type || 'info';
  row.dataset.logId = String(entry.id);
  if (entry.type === 'missed' && animate) row.classList.add('fr-log-missed-pulse');

  const time = document.createElement('time');
  time.className = 'fr-log-time';
  time.dateTime = new Date(entry.at).toISOString();
  time.textContent = new Date(entry.at).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const badge = document.createElement('span');
  badge.className = 'fr-log-badge';
  badge.textContent = logTypeLabel(entry.type);
  const message = document.createElement('span');
  message.className = 'fr-log-message';
  message.textContent = entry.message;
  row.append(time, badge, message);
  return row;
}

export function updateBotLogStats(content) {
  const summary = content.querySelector('.fr-log-summary');
  if (!summary) return;
  const stats = summarizeBotStats(state.botStats);
  summary.textContent = 'Alınan ' + stats.bought + ' · Kaçırılan ' + stats.missed + ' · Arama ' + stats.searches;
}

function renderLogRows(content) {
  const list = content.querySelector('.fr-log-list');
  const filter = content.dataset.logFilter || 'all';
  const entries = filterBotLogs(state.botLogs.slice(0, 100), filter);
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'fr-target-empty';
    empty.textContent = 'Henüz FutRUSH işlem kaydı yok.';
    list.appendChild(empty);
    return;
  }
  entries.forEach((entry) => list.appendChild(createLogRow(entry, false)));
}

export function renderBotLogs(content) {
  content.dataset.logFilter = 'all';
  content.innerHTML =
    '<div class="fr-logs-view">' +
      '<div class="fr-waitbar" hidden></div>' +
      '<div class="fr-log-summary"></div>' +
      '<div class="fr-log-toolbar"><div class="fr-log-filters" role="group" aria-label="Log filtresi"></div><button class="fr-log-clear" type="button">Temizle</button></div>' +
      '<div class="fr-log-list" role="log" aria-live="polite"></div>' +
    '</div>';
  const filters = content.querySelector('.fr-log-filters');
  LOG_FILTERS.forEach((filter) => {
    const button = document.createElement('button');
    button.className = 'fr-log-filter';
    button.type = 'button';
    button.dataset.filter = filter.id;
    button.setAttribute('aria-pressed', String(filter.id === content.dataset.logFilter));
    button.textContent = filter.label;
    button.addEventListener('click', () => {
      content.dataset.logFilter = filter.id;
      filters.querySelectorAll('.fr-log-filter').forEach((chip) => {
        chip.setAttribute('aria-pressed', String(chip === button));
      });
      renderLogRows(content);
    });
    filters.appendChild(button);
  });
  content.querySelector('.fr-log-clear').addEventListener('click', () => {
    state.botLogs.length = 0;
    renderLogRows(content);
  });
  updateBotLogStats(content);
  renderLogRows(content);
  mountWaitBar(content.querySelector('.fr-waitbar'));
}

export function addBotLogEntry(content) {
  const list = content.querySelector('.fr-log-list');
  if (!list) return;
  const entry = state.botLogs[0];
  if (!entry || list.querySelector('[data-log-id="' + entry.id + '"]')) return;
  const filter = content.dataset.logFilter || 'all';
  if (filterBotLogs([entry], filter).length) {
    const empty = list.querySelector('.fr-target-empty');
    if (empty) empty.remove();
    list.prepend(createLogRow(entry, true));
  }
  while (list.querySelectorAll('.fr-log-row').length > 100) list.lastElementChild.remove();
}
