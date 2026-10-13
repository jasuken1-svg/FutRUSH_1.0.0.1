// Hedef, bot logu ve bot durumu olaylarini acik panel gorunumlerine yansitir.
// Bagimliliklar: core/events/state, ui/panel ve panel sekme cizicileri.

import { on } from '../../core/events.js';
import { state } from '../../core/state.js';
import { panel } from './panel.js';
import { renderBotLogs } from './tabs/logsTab.js';
import { renderTargetContent } from './tabs/targetsTab.js';

export function registerPanelEvents() {
  on('targets:changed', () => {
    const content = panel?.querySelector('.fc-snipe-tab-content');
    if (content && state.activePanelTab === 'targets') renderTargetContent(content);
  });
  on('log:added', () => {
    const content = panel?.querySelector('.fc-snipe-tab-content');
    if (content && state.activePanelTab === 'logs') renderBotLogs(content);
  });
  on('bot:status', () => {
    const content = panel?.querySelector('.fc-snipe-tab-content');
    if (content && state.activePanelTab === 'settings') {
      const status = content.querySelector('.fr-bot-status');
      const button = content.querySelector('.fr-start span');
      if (status) status.textContent = state.botStatus;
      if (button) button.textContent = state.botRunning ? 'Durdur FutRUSH' : 'Başlat FutRUSH';
    }
  });
}
