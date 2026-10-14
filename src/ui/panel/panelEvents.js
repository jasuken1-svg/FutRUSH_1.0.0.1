// Hedef, bot logu ve bot durumu olaylarini acik panel gorunumlerine yansitir.
// Bagimliliklar: core/events/state, ui/panel ve panel sekme cizicileri.

import { on } from '../../core/events.js';
import { state } from '../../core/state.js';
import { panel } from './panel.js';
import { addBotLogEntry, updateBotLogStats } from './tabs/logsTab.js';
import { expireTargetStatus, renderTargetContent, updateTargetStatus } from './tabs/targetsTab.js';

function updateStartButton(content) {
  const button = content.querySelector('.fr-start');
  if (!button) return;
  const running = state.botRunning;
  button.dataset.state = running ? 'running' : 'idle';
  button.setAttribute('aria-pressed', String(running));
  button.setAttribute('aria-label', running ? 'Durdur FutRUSH' : 'Başlat FutRUSH');
}

export function registerPanelEvents() {
  on('targets:changed', () => {
    const content = panel?.querySelector('.fc-snipe-tab-content');
    if (content && state.activePanelTab === 'targets') renderTargetContent(content);
  });
  on('targets:status', () => {
    const content = panel?.querySelector('.fc-snipe-tab-content');
    if (!content || state.activePanelTab !== 'targets') return;
    const status = content.querySelector('.fr-target-status');
    if (status) updateTargetStatus(status, state.targetStatus, state.targetLoading);
    else renderTargetContent(content);
  });
  on('targets:status-expire', () => {
    const content = panel?.querySelector('.fc-snipe-tab-content');
    if (content && state.activePanelTab === 'targets') expireTargetStatus(content);
  });
  on('log:added', () => {
    const content = panel?.querySelector('.fc-snipe-tab-content');
    if (content && state.activePanelTab === 'logs') addBotLogEntry(content);
  });
  on('bot:stats', () => {
    const content = panel?.querySelector('.fc-snipe-tab-content');
    if (content && state.activePanelTab === 'logs') updateBotLogStats(content);
  });
  on('bot:status', () => {
    const content = panel?.querySelector('.fc-snipe-tab-content');
    if (content && state.activePanelTab === 'settings') {
      updateStartButton(content);
    }
  });
}
