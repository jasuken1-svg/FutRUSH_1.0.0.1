import { CONFIG } from '../core/config.js';
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { inTransfers } from '../ea/page.js';
import { LOGO_SVG } from './icons.js';

export const LG = CONFIG.logoButton;

export function initLogoButton() {
    const st = document.createElement('style');
    st.textContent = `
    button.${LG.className} {
      position: absolute; z-index: 5; box-sizing: border-box;
      width: ${LG.size}px; height: ${LG.size}px; margin: 0; padding: 0;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: 0; outline: 0; cursor: pointer;
      transition: filter .15s, transform .15s;
    }
    button.${LG.className} svg { display: block; width: 100%; height: 100%; }
    button.${LG.className}:hover { filter: brightness(1.15) drop-shadow(0 0 6px rgba(0, 229, 255, .55)); transform: scale(1.06); }
    button.${LG.className}.fr-open { filter: drop-shadow(0 0 8px rgba(0, 229, 255, .85)); }
  `;
    document.head.appendChild(st);
  }

export function findLogoAnchor() {
    if (!inTransfers()) return null;
    return Array.from(document.querySelectorAll('button.ea-filter-bar-item-view')).find((b) =>
      LG.anchorPattern.test(b.textContent) && b.getBoundingClientRect().width > 20) || null;
  }

export function placeLogoButton() {
    let logo = document.querySelector('button.' + LG.className);
    const anchor = findLogoAnchor();

    // sekme çubuğu yoksa (başka sayfa / Transfers dışı): logoyu kaldır, panel kapansın
    if (!anchor) {
      if (logo) logo.remove();
      state.logoPresent = false;
      state.panelOpen = false;
      return;
    }

    const bar = anchor.parentElement;
    if (!logo) {
      logo = document.createElement('button');
      logo.type = 'button';
      logo.className = LG.className;
      logo.title = LG.title;
      logo.setAttribute('aria-label', LG.title);
      logo.innerHTML = LOGO_SVG;
      logo.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        state.panelOpen = !state.panelOpen;
        emit('layout:request-sync');
      });
    }
    if (logo.parentElement !== bar) bar.appendChild(logo);
    state.logoPresent = true;

    // Mutlak konum: sekmelerin yerleşimine dokunmaz (çubuğun içeriği kaymaz)
    if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
    const br = bar.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const sx = br.width / (bar.offsetWidth || br.width || 1);     // sayfa ölçeklenmişse (fitContent) düzelt
    const sy = br.height / (bar.offsetHeight || br.height || 1);
    const left = (ar.right - br.left) / sx - bar.clientLeft + LG.gap;
    const top = (ar.top - br.top) / sy - bar.clientTop + (ar.height / sy - LG.size) / 2;
    logo.style.left = Math.round(left) + 'px';
    logo.style.top = Math.round(top) + 'px';
    logo.classList.toggle('fr-open', state.panelOpen);
  }
