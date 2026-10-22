// Panel sekmelerini cizer ve secili sekmenin icerik cizicisini cagirir.
// Bagimliliklar: core/state, core/events, bot/safetyGovernor ve ui/panel tab modulleri.

import { state } from '../../core/state.js';
import { on } from '../../core/events.js';
import { safetyGovernor } from '../../bot/safetyGovernor.js';
import { renderPanelSettings } from './tabs/settingsTab.js';
import { renderTargetContent } from './tabs/targetsTab.js';
import { unmountWaitBar } from './waitBar.js';
import { SPEED_TIERS, formatTierSeconds } from '../../bot/speedTiers.js';

export function renderPanelTabs(panel) {
    unmountWaitBar();
    const tabs = [
      { id: 'targets', label: 'Oyuncu Hedefleri' },
      { id: 'settings', label: 'Ayarlar' }
    ];
    if (state.activePanelTab === 'logs') {
      state.activePanelTab = 'targets';
    }
    panel.classList.add('fc-snipe-expanded');
    panel.innerHTML =
      '<div class="fr-governor-banner" style="display: none;" role="alert">' +
        '<span class="fr-governor-banner-msg"></span>' +
        '<button class="fr-governor-resume-btn" type="button">Devam Et ▶</button>' +
      '</div>' +
      '<div class="fc-snipe-tabs" role="tablist" aria-label="SNIPE sekmeleri">' +
      tabs.map((tab) => '<button class="fc-snipe-tab" type="button" role="tab" data-tab="' + tab.id + '" aria-selected="' + (state.activePanelTab === tab.id) + '">' + tab.label + '</button>').join('') +
      '<div class="fr-dry-run-top-badge" role="status" aria-label="Kuru çalıştırma modu aktif" style="display: none;">KURU ÇALIŞTIRMA</div>' +
      '<div class="speed-tier-top-badge" role="status" aria-label="Aktif arama hızı"></div>' +
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

    const dryRunBadge = panel.querySelector('.fr-dry-run-top-badge');
    const syncDryRunBadge = () => {
      if (!dryRunBadge) return;
      dryRunBadge.style.display = state.snipeSettings?.dryRun ? 'inline-flex' : 'none';
    };
    syncDryRunBadge();
    on('bot:dryrun-changed', syncDryRunBadge);

    const speedBadge = panel.querySelector('.speed-tier-top-badge');
    const syncSpeedBadge = () => {
      if (!speedBadge) return;
      const speed = Number.isInteger(state.snipeSettings?.speed) ? state.snipeSettings.speed : 1;
      const tier = SPEED_TIERS[speed] || SPEED_TIERS[1];
      const sec = state.snipeSettings?.speedDelays?.[speed] ?? tier.defaultSec;
      const warnIcon = tier.isWarning ? '⚠ ' : '';
      speedBadge.innerHTML = `<span class="speed-tier-badge-dot" style="color:${tier.color}">●</span> <span class="speed-tier-badge-name" style="color:${tier.color}">${warnIcon}${tier.name}</span> <span class="speed-tier-badge-sec">${formatTierSeconds(sec)} sn</span>`;
      speedBadge.style.borderColor = tier.color + '55';
      speedBadge.style.background = tier.color + '18';
    };
    syncSpeedBadge();
    on('bot:speed-changed', syncSpeedBadge);

    const banner = panel.querySelector('.fr-governor-banner');
    const bannerMsg = panel.querySelector('.fr-governor-banner-msg');
    const resumeBtn = panel.querySelector('.fr-governor-resume-btn');
    const syncBanner = () => {
      if (!banner) return;
      if (safetyGovernor.isHalted()) {
        banner.style.display = 'flex';
        const isCaptcha = safetyGovernor.isCaptchaHalted?.();
        if (isCaptcha) {
          banner.classList.add('fr-governor-banner--captcha');
          bannerMsg.innerHTML = '🚨 <strong>CAPTCHA TESPİT EDİLDİ!</strong> EA doğrulaması gerekiyor.';
          if (resumeBtn) {
            resumeBtn.textContent = "Captcha'yı çözdüm, devam et";
            resumeBtn.classList.add('fr-governor-resume-btn--captcha');
          }
        } else {
          banner.classList.remove('fr-governor-banner--captcha');
          bannerMsg.textContent = '⛔ ' + safetyGovernor.getHaltReason();
          if (resumeBtn) {
            resumeBtn.textContent = 'Devam Et ▶';
            resumeBtn.classList.remove('fr-governor-resume-btn--captcha');
          }
        }
      } else {
        banner.style.display = 'none';
        banner.classList.remove('fr-governor-banner--captcha');
      }
    };
    syncBanner();
    panel.querySelector('.fr-governor-resume-btn')?.addEventListener('click', () => {
      safetyGovernor.resume();
      syncBanner();
    });
    on('governor:halt', syncBanner);
    on('governor:resume', syncBanner);
  }

export function renderPanelTabContent(content) {
  unmountWaitBar();
  content.dataset.activeTab = state.activePanelTab;
  if (state.activePanelTab === 'settings') {
    renderPanelSettings(content);
    return;
  }
  renderTargetContent(content);
}
