// EA sayfasindaki DOM, pencere ve navigasyon degisikliklerinde yeniden senkronizasyon ister.
// Bagimliliklar: core/state, core/scheduler ve utils/dom.

import { state } from './state.js';
import { schedule } from './scheduler.js';
import { pageWindow } from '../utils/dom.js';

export function initDomEvents() {
  // Ana menüde Transfers dışına tıklanırsa paneli gizle
  document.addEventListener('click', (e) => {
    const item = e.target.closest && e.target.closest('[class*="tab-bar-item"]');
    if (!item) return;
    state.visible = /transfer/i.test(item.className + ' ' + item.textContent);
    schedule();
  }, true);

  if (typeof MutationObserver !== 'undefined' && document.body) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  pageWindow.addEventListener('resize', schedule);
  pageWindow.addEventListener('scroll', (e) => {
    // FutRUSH içi kaydırmalarda gereksiz layout sync tetikleme
    if (e.target && e.target.closest && (e.target.closest('#fr-hub-view') || e.target.closest('#fc-snipe-panel'))) {
      return;
    }
    schedule();
  }, true);

  // Orta mouse tuşunun (Mouse 3 / tekerlek tıklaması) tarayıcıda yanlışlıkla
  // otomatik kaydırma (autoscroll) modunu tetiklemesini ve imlecin takılı kalmasını engelle
  const preventMiddleClickAutoscroll = (e) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  };
  document.addEventListener('pointerdown', preventMiddleClickAutoscroll, { capture: true });
  document.addEventListener('mousedown', preventMiddleClickAutoscroll, { capture: true });
  document.addEventListener('auxclick', preventMiddleClickAutoscroll, { capture: true });
}
