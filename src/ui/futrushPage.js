// ut-tab-bar-view icerisine FutRUSH sekmesi ekler ve ozel FutRUSH sayfa gorunumunu yonetir.
// Bagimliliklar: ui/icons, core/state, ui/panel/panel, ui/panel/panelTabs, ui/marketLogBox.

import { LOGO_SVG } from './icons.js';
import { state } from '../core/state.js';
import { panel, applyGeom } from './panel/panel.js';
import { renderPanelTabs } from './panel/panelTabs.js';
import { toggleMarketLogBox, renderMarketLogBox, openMarketLogBox, mountMarketLogBox } from './marketLogBox.js';

let tabEl = null;
let hubContainer = null;
let logIconBtn = null;
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

    .fr-header-log-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      margin: 0 8px;
      padding: 0;
      background: rgba(0, 229, 255, 0.1);
      border: 1px solid rgba(0, 229, 255, 0.35);
      border-radius: 6px;
      cursor: pointer;
      color: #00e5ff;
      transition: all 0.2s ease;
      z-index: 100;
      box-sizing: border-box;
      vertical-align: middle;
    }
    .fr-header-log-btn:hover {
      background: rgba(0, 229, 255, 0.25);
      border-color: #00e5ff;
      color: #fff;
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.55);
      transform: scale(1.05);
    }
    .fr-header-log-btn .fr-header-log-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
    }
    .fr-header-log-btn .fr-header-log-icon svg {
      width: 100%;
      height: 100%;
    }
    .fr-header-log-tooltip {
      position: absolute;
      top: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      background: #0f1a2c;
      border: 1px solid rgba(0, 229, 255, 0.5);
      color: #e2e8f0;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, visibility 0.15s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
      z-index: 1000;
    }
    .fr-header-log-btn:hover .fr-header-log-tooltip {
      opacity: 1;
      visibility: visible;
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
      gap: 15px;
      padding: 16px;
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
    #fr-hub-view .fr-market-log-box:not(.fr-dragged) {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      width: 400px !important;
      min-width: 400px !important;
      height: 400px !important;
      min-height: 400px !important;
      flex: 0 0 400px !important;
      border-radius: 0 !important;
      display: flex !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
    }
    #fr-hub-view .fr-market-log-box.fr-dragged {
      position: fixed !important;
      border-radius: 0 !important;
      display: flex !important;
      z-index: 99999 !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7) !important;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

export function updateNavigationTitle(isFutrushActive) {
  const navBar = document.querySelector('.ut-navigation-bar-view');
  if (!navBar) return;

  const titleEl = navBar.querySelector('.title, h1, [class*="title"]');
  if (!titleEl) return;

  if (isFutrushActive) {
    if (titleEl.textContent !== 'FutRUSH Panel') {
      if (!titleEl.dataset.frOrigTitle && titleEl.textContent) {
        titleEl.dataset.frOrigTitle = titleEl.textContent;
      }
      titleEl.textContent = 'FutRUSH Panel';
    }
  } else if (titleEl.dataset.frOrigTitle && titleEl.textContent === 'FutRUSH Panel') {
    titleEl.textContent = titleEl.dataset.frOrigTitle;
    delete titleEl.dataset.frOrigTitle;
  }
}

export function placeHeaderLogButton() {
  const header = document.querySelector('.fc-header-view, fc-header-view, #fc-header-view')
    || document.querySelector('.ut-navigation-bar-view');
  if (!header) return null;

  if (!logIconBtn) {
    logIconBtn = document.createElement('button');
    logIconBtn.type = 'button';
    logIconBtn.className = 'fr-header-log-btn';
    logIconBtn.title = 'Genel Logları göster';
    logIconBtn.setAttribute('aria-label', 'Genel Logları göster');
    logIconBtn.innerHTML =
      '<span class="fr-header-log-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
          '<polyline points="14 2 14 8 20 8"></polyline>' +
          '<line x1="16" y1="13" x2="8" y2="13"></line>' +
          '<line x1="16" y1="17" x2="8" y2="17"></line>' +
          '<polyline points="10 9 9 9 8 9"></polyline>' +
        '</svg>' +
      '</span>' +
      '<span class="fr-header-log-tooltip">Genel Logları göster</span>';
    logIconBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMarketLogBox();
    });
  }

  const titleEl = header.querySelector('.title, h1, [class*="title"]');
  if (titleEl && titleEl.parentElement) {
    if (logIconBtn.previousElementSibling !== titleEl) {
      titleEl.parentElement.insertBefore(logIconBtn, titleEl.nextSibling);
    }
  } else if (logIconBtn.parentElement !== header) {
    header.appendChild(logIconBtn);
  }

  logIconBtn.style.display = state.futrushPageActive ? 'inline-flex' : 'none';
  return logIconBtn;
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

  // fc-snipe-panel hub container icinde en solda konumlanir
  if (panel && panel.parentElement !== hubContainer) {
    if (hubContainer.firstChild) {
      hubContainer.insertBefore(panel, hubContainer.firstChild);
    } else {
      hubContainer.appendChild(panel);
    }
  }

  // Genel Log kutusu (#fc-snipe-panel'in 15px saginda ayni yukseklikte yer alir)
  mountMarketLogBox(hubContainer);
  const logBox = hubContainer.querySelector('.fr-market-log-box');
  if (panel && logBox && logBox.previousElementSibling !== panel) {
    hubContainer.insertBefore(logBox, panel.nextSibling);
  }

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
  openMarketLogBox();
  placeHeaderLogButton();

  const contentArea = document.querySelector('.ut-navigation-container-view--content');
  if (contentArea) {
    contentArea.style.setProperty('display', 'none', 'important');
    eaContentHidden = true;
  }

  if (hubContainer) {
    hubContainer.style.setProperty('display', 'flex', 'important');
  }

  updateNavigationTitle(true);

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

  if (logIconBtn) {
    logIconBtn.style.display = 'none';
  }

  if (hubContainer) {
    hubContainer.style.setProperty('display', 'none', 'important');
  }

  const contentArea = document.querySelector('.ut-navigation-container-view--content');
  if (contentArea && eaContentHidden) {
    contentArea.style.display = '';
    eaContentHidden = false;
  }

  updateNavigationTitle(false);
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
  placeHeaderLogButton();
  syncPageVisibility();
}

export function getTabElement() {
  return tabEl;
}

export function getHubContainer() {
  return hubContainer;
}

export function getHeaderLogButton() {
  return logIconBtn;
}
