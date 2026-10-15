// Panel sekmelerini cizer ve secili sekmenin icerik cizicisini cagirir.
// Bagimliliklar: core/state, bot/autoBuyer ve ui/panel tab modulleri.

import { state } from '../../core/state.js';
import { renderPanelSettings } from './tabs/settingsTab.js';
import { renderBotLogs } from './tabs/logsTab.js';
import { renderTargetContent } from './tabs/targetsTab.js';
import { unmountWaitBar } from './waitBar.js';

export function renderPanelTabs(panel) {
    unmountWaitBar();
    const tabs = [
      { id: 'targets', label: 'Oyuncu Hedefleri' },
      { id: 'settings', label: 'Ayarlar' },
      { id: 'logs', label: 'Loglar' }
    ];
    panel.classList.add('fc-snipe-expanded');
    panel.innerHTML = '<div class="fc-snipe-tabs" role="tablist" aria-label="SNIPE sekmeleri">' +
      tabs.map((tab) => '<button class="fc-snipe-tab" type="button" role="tab" data-tab="' + tab.id + '" aria-selected="' + (state.activePanelTab === tab.id) + '">' + tab.label + '</button>').join('') +
      '</div><div class="fc-snipe-tab-content" role="tabpanel" aria-live="polite"></div>';
    const content = panel.querySelector('.fc-snipe-tab-content');
    renderPanelTabContent(content);
    panel.querySelectorAll('.fc-snipe-tab').forEach((button) => {
      button.addEventListener('click', () => {
        state.activePanelTab = button.dataset.tab;
        panel.querySelectorAll('.fc-snipe-tab').forEach((tab) => tab.setAttribute('aria-selected', String(tab === button)));
        renderPanelTabContent(content);
      });
    });
  }

export function renderPanelTabContent(content) {
  unmountWaitBar();
  content.dataset.activeTab = state.activePanelTab;
  if (state.activePanelTab === 'targets') {
    renderTargetContent(content);
    return;
  }
  if (state.activePanelTab === 'settings') {
    renderPanelSettings(content);
    return;
  }
  renderBotLogs(content);
}
