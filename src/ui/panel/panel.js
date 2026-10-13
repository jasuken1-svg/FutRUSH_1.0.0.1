// SNIPE panelini olusturur, aciklik durumunu ve kayitli geometrisini uygular.
// Bagimliliklar: core/config/state/storage, ea/page, utils/dom ve panel CSS'i.

import { CONFIG, P } from '../../core/config.js';
import { state } from '../../core/state.js';
import { loadCoreStorage } from '../../core/storage.js';
import { loadTargetStorage } from '../../targets/targetStore.js';
import { inTransfers, topLimit } from '../../ea/page.js';
import { vw, vh } from '../../utils/dom.js';
import { panelCss } from './panel.css.js';
import { renderPanelTabs } from './panelTabs.js';

export let panel = null;

export function initPanel() {
    const style = document.createElement('style');
    style.textContent = panelCss;
    document.head.appendChild(style);

    panel = document.createElement('div');
    panel.id = P.id;
    panel.innerHTML = '<button class="fc-snipe-btn" type="button">' + P.buttonText + '</button>';
    panel.querySelector('.fc-snipe-btn').addEventListener('click', () => {
      state.panelExpanded = true;
      renderPanelTabs(panel);
    });
    document.body.appendChild(panel);

    // Son ölçüyü hatırla (pencere oranı olarak)
    loadCoreStorage();
    loadTargetStorage();
  }

export function panelShown() {
    return CONFIG.features.logoButton && state.panelOpen && state.logoPresent && inTransfers();
  }

export function applyGeom() {
    const geom = state.geom;
    if (!geom) { panel.style.display = 'none'; return; }
    const left = geom.l * vw();
    const top0 = geom.t * vh() - state.liveScroll;
    const w0 = geom.w * vw();
    const h0 = geom.h * vh();

    // başlık çubuğunun altında kal, pencere dışına taşma
    const top = Math.max(top0, topLimit());
    const h = Math.max(0, Math.min(h0, vh() - P.edge - top));
    const w = Math.max(0, Math.min(w0, vw() - P.edge - left));

    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
    panel.style.width = Math.round(w) + 'px';
    panel.style.height = Math.round(h) + 'px';
    panel.style.display = panelShown() ? 'flex' : 'none';
    if (!state.panelExpanded) panel.classList.remove('fc-snipe-expanded');
  }
