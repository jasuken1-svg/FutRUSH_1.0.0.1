// Transfer Market ekranında log kutusunu senkronize eder (Ekle FutRUSH butonu kaldırıldı).
// Bağımlılıklar: core/config, ui/marketLogBox.

import { CONFIG } from '../core/config.js';
import { mountMarketLogBox, syncMarketLogVisibility } from './marketLogBox.js';

const SB = CONFIG.searchButton;

export function initSearchButton() {}

export function placeSearchButton() {
  mountMarketLogBox();
  syncMarketLogVisibility();
  if (typeof document !== 'undefined') {
    const existing = document.querySelectorAll('.' + SB.className);
    existing.forEach((el) => {
      const parent = el.parentElement;
      if (parent) {
        parent.style.removeProperty('display');
        parent.style.removeProperty('flex-wrap');
        parent.style.removeProperty('align-items');
        parent.style.removeProperty('column-gap');
        Array.from(parent.children).forEach((child) => {
          child.style.removeProperty('flex');
          child.style.removeProperty('width');
          child.style.removeProperty('min-width');
          child.style.removeProperty('max-width');
          child.style.removeProperty('margin');
          child.style.removeProperty('box-sizing');
          child.style.removeProperty('height');
        });
      }
      el.remove();
    });
  }
}
