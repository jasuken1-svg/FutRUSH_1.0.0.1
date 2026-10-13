import { state } from '../../../core/state.js';

export function renderBotLogs(content) {
    content.innerHTML = '<div class="fr-log-list" role="log" aria-live="polite"></div>';
    const list = content.querySelector('.fr-log-list');
    if (!state.botLogs.length) {
      const empty = document.createElement('div');
      empty.className = 'fr-target-empty';
      empty.textContent = 'Henüz FutRUSH işlem kaydı yok.';
      list.appendChild(empty);
      return;
    }
    state.botLogs.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'fr-log-row';
      row.dataset.type = entry.type;
      row.textContent = new Date(entry.at).toLocaleTimeString('tr-TR') + ' · ' + entry.message;
      list.appendChild(row);
    });
  }
