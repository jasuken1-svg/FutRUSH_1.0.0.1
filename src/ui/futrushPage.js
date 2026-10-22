// ut-tab-bar-view icerisine FutRUSH sekmesi ekler ve ozel FutRUSH sayfa gorunumunu yonetir.
// Bagimliliklar: ui/icons, core/state, ui/panel/panel, ui/panel/panelTabs, ui/marketLogBox.

import { LOGO_SVG } from './icons.js';
import { state } from '../core/state.js';
import { panel, applyGeom } from './panel/panel.js';
import { renderPanelTabs } from './panel/panelTabs.js';
import { mountMarketLogBox, renderMarketLogBox } from './marketLogBox.js';

let tabEl = null;
let hubContainer = null;
let eaContentHidden = false;
let stylesInjected = false;

function ensureStyles() {
  if (stylesInjected || document.getElementById('fr-futrush-page-style')) return;
  const style = document.createElement('style');
  style.id = 'fr-futrush-page-style';
  style.textContent = `
    .ut-tab-bar-item.fr-tab-bar-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      background: transparent;
      border: 0;
      outline: 0;
      cursor: pointer;
      padding: 6px 4px;
      color: var(--fr-tab-color, rgba(255, 255, 255, 0.7));
      transition: color 0.15s, background-color 0.15s;
    }
    .ut-tab-bar-item.fr-tab-bar-item::before {
      display: none !important;
      content: none !important;
    }
    .ut-tab-bar-item.fr-tab-bar-item:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.06);
    }
    .ut-tab-bar-item.fr-tab-bar-item.selected {
      color: #fff !important;
      background: rgba(0, 229, 255, 0.12) !important;
    }
    .ut-tab-bar-item.fr-tab-bar-item .fr-tab-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      flex: 0 0 26px;
      margin-bottom: 4px;
    }
    .ut-tab-bar-item.fr-tab-bar-item .fr-tab-icon svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .ut-tab-bar-item.fr-tab-bar-item.selected .fr-tab-icon {
      filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.85));
    }
    .ut-tab-bar-item.fr-tab-bar-item .fr-tab-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      letter-spacing: 0.5px;
      text-align: center;
      line-height: 1.2;
    }

    #fr-hub-view {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: calc(100vh - 70px);
      box-sizing: border-box;
      display: none;
      flex-direction: row;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 16px;
      padding: 20px;
      overflow-x: auto;
      overflow-y: auto;
      background: rgba(10, 17, 28, 0.98);
      z-index: 10;
    }
    #fr-hub-view #fc-snipe-panel {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      flex: 0 0 auto !important;
      display: flex !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
    }
    #fr-hub-view .fr-market-log-box {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      width: 380px !important;
      height: 450px !important;
      flex: 0 0 380px !important;
      display: flex !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

function setupGlobalTabListeners() {
  document.addEventListener('click', (e) => {
    const clickedItem = e.target.closest && e.target.closest('.ut-tab-bar-item');
    if (!clickedItem) return;
    if (clickedItem === tabEl) {
      openFutrushPage();
    } else {
      closeFutrushPage();
    }
  }, true);
}

export function initFutrushPage() {
  ensureStyles();
  setupGlobalTabListeners();
}

export function ensureHubContainer() {
  if (!hubContainer || !hubContainer.isConnected) {
    let existing = document.getElementById('fr-hub-view');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'fr-hub-view';
    }
    hubContainer = existing;

    const navContainer = document.querySelector('.ut-navigation-container-view');
    const contentArea = document.querySelector('.ut-navigation-container-view--content');
    if (navContainer) {
      if (existing.parentElement !== navContainer) {
        navContainer.appendChild(existing);
      }
    } else if (contentArea && contentArea.parentElement) {
      if (existing.parentElement !== contentArea.parentElement) {
        contentArea.parentElement.appendChild(existing);
      }
    } else if (document.body && existing.parentElement !== document.body) {
      document.body.appendChild(existing);
    }
  }

  // fc-snipe-panel hub container icine ilk eleman olarak tasinir
  if (panel && panel.parentElement !== hubContainer) {
    hubContainer.appendChild(panel);
  }

  // FutRUSH Log hub container icine baglanir
  mountMarketLogBox(hubContainer);
  return hubContainer;
}

export function openFutrushPage() {
  state.futrushPageActive = true;
  if (tabEl) {
    tabEl.classList.add('selected');
  }

  const nav = document.querySelector('nav.ut-tab-bar') || document.querySelector('.ut-tab-bar');
  if (nav) {
    nav.querySelectorAll('.ut-tab-bar-item').forEach((item) => {
      if (item !== tabEl) item.classList.remove('selected');
    });
  }

  ensureHubContainer();

  const contentArea = document.querySelector('.ut-navigation-container-view--content');
  if (contentArea) {
    contentArea.style.setProperty('display', 'none', 'important');
    eaContentHidden = true;
  }

  if (hubContainer) {
    hubContainer.style.setProperty('display', 'flex', 'important');
  }

  if (panel) {
    if (!state.panelExpanded) {
      state.panelExpanded = true;
      renderPanelTabs(panel);
    }
    applyGeom();
  }

  renderMarketLogBox();
}

export function closeFutrushPage() {
  state.futrushPageActive = false;
  if (tabEl) {
    tabEl.classList.remove('selected');
  }

  if (hubContainer) {
    hubContainer.style.setProperty('display', 'none', 'important');
  }

  const contentArea = document.querySelector('.ut-navigation-container-view--content');
  if (contentArea && eaContentHidden) {
    contentArea.style.display = '';
    eaContentHidden = false;
  }
}

export function syncPageVisibility() {
  if (!tabEl || !hubContainer) return;
  const nav = tabEl.parentElement;
  if (!nav) return;

  const otherSelected = Array.from(nav.querySelectorAll('.ut-tab-bar-item')).find(
    (item) => item !== tabEl && item.classList.contains('selected')
  );

  if (otherSelected) {
    if (state.futrushPageActive) {
      closeFutrushPage();
    }
  } else if (state.futrushPageActive) {
    openFutrushPage();
  }
}

export function placeFutrushTab() {
  ensureStyles();
  const nav = document.querySelector('nav.ut-tab-bar') || document.querySelector('.ut-tab-bar');
  if (!nav) return;

  if (!tabEl) {
    tabEl = document.createElement('button');
    tabEl.type = 'button';
    tabEl.className = 'ut-tab-bar-item fr-tab-bar-item';
    tabEl.title = 'FutRUSH';
    tabEl.setAttribute('aria-label', 'FutRUSH');
    tabEl.innerHTML =
      '<span class="fr-tab-icon">' + LOGO_SVG + '</span>' +
      '<span class="fr-tab-label">FutRUSH</span>';
    tabEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openFutrushPage();
    });
  }

  const items = Array.from(nav.querySelectorAll('.ut-tab-bar-item')).filter(
    (item) => item !== tabEl && !item.classList.contains('fr-tab-bar-item')
  );

  // Evolutions sekmesini bul
  const evoIndex = items.findIndex((i) =>
    /evolution|geliştirme|gelistirme/i.test(i.className + ' ' + i.textContent)
  );

  // SBC sekmesini bul
  const sbcIndex = items.findIndex((i) =>
    /sbc|kko|kadro.*kurma/i.test(i.className + ' ' + i.textContent)
  );

  let targetBefore = null;
  if (evoIndex !== -1) {
    targetBefore = items[evoIndex];
  } else if (sbcIndex !== -1) {
    targetBefore = items[sbcIndex + 1] || null;
  } else if (items.length >= 3) {
    targetBefore = items[3];
  }

  if (targetBefore) {
    if (tabEl.nextSibling !== targetBefore || tabEl.parentElement !== nav) {
      nav.insertBefore(tabEl, targetBefore);
    }
  } else {
    if (tabEl.parentElement !== nav) {
      nav.appendChild(tabEl);
    }
  }

  ensureHubContainer();
  syncPageVisibility();
}

export function getTabElement() {
  return tabEl;
}

export function getHubContainer() {
  return hubContainer;
}
