// Bot log kayitlarini panelin log sekmesinde goruntuler.
// Bagimlilik: core/state.

import { state } from '../../../core/state.js';
import { logTone, summarizeBotStats } from '../panelLogic.js';
import { mountWaitBar } from '../waitBar.js';

function createLogRow(entry, animate) {
  const row = document.createElement('div');
  row.className = 'fr-log-row' + (animate ? ' fr-log-enter' : '');
  row.dataset.type = entry.type || 'info';
  row.dataset.tone = logTone(entry.type);
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
  const message = document.createElement('span');
  message.className = 'fr-log-message';
  message.textContent = entry.message;
  row.append(time, message);
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
  const entries = state.botLogs.slice(0, 100);
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
  content.innerHTML =
    '<div class="fr-logs-view">' +
      '<div class="fr-waitbar" hidden></div>' +
      '<div class="fr-log-summary"></div>' +
      '<div class="fr-log-toolbar"><button class="fr-log-clear" type="button">Temizle</button></div>' +
      '<div class="fr-log-list" role="log" aria-live="polite"></div>' +
    '</div>';
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
  const empty = list.querySelector('.fr-target-empty');
  if (empty) empty.remove();
  list.prepend(createLogRow(entry, true));
  while (list.querySelectorAll('.fr-log-row').length > 100) list.lastElementChild.remove();
}
