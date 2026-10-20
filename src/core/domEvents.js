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

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  pageWindow.addEventListener('resize', schedule);
  pageWindow.addEventListener('scroll', schedule, true);
}
