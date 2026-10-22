// ut-tab-bar-view icerisine FutRUSH sekmesi ekler ve ozel FutRUSH sayfa gorunumunu yonetir.
// Bagimliliklar: ui/icons, core/state, ui/panel/panel, ui/panel/panelTabs, ui/marketLogBox.

import { LOGO_SVG } from './icons.js';
import { state } from '../core/state.js';
import { panel, applyGeom } from './panel/panel.js';
import { renderPanelTabs } from './panel/panelTabs.js';
import { mountMarketLogBox, renderMarketLogBox } from './marketLogBox.js';

let tabEl = null;
let hubContainer = null;
let headerContainer = null;
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

    .fc-header-view {
      position: relative;
      width: 100%;
      box-sizing: border-box;
      display: none;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      padding: 8px 16px;
      background: rgba(10, 17, 28, 0.95);
      border-bottom: 1px solid rgba(0, 229, 255, 0.15);
      flex: 0 0 auto;
      gap: 12px;
      z-index: 10;
    }
    .fc-header-view .fr-market-log-box {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      width: 440px !important;
      max-width: 100% !important;
      height: 84px !important;
      flex: 0 0 auto !important;
      display: flex !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
    }

    #fr-hub-view {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: calc(100vh - 150px);
      box-sizing: border-box;
      display: none;
      flex-direction: row;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 16px;
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

export function ensureHeaderContainer() {
  if (!headerContainer || !headerContainer.isConnected) {
    let existing = document.querySelector('.fc-header-view, fc-header-view, #fc-header-view');
    if (!existing) {
      existing = document.createElement('div');
      existing.className = 'fc-header-view';
      existing.id = 'fc-header-view';
    }
    headerContainer = existing;

    const navContainer = document.querySelector('.ut-navigation-container-view');
    const contentArea = document.querySelector('.ut-navigation-container-view--content');
    const hub = document.getElementById('fr-hub-view');

    if (navContainer) {
      if (existing.parentElement !== navContainer) {
        if (hub && hub.parentElement === navContainer) {
          navContainer.insertBefore(existing, hub);
        } else {
          navContainer.appendChild(existing);
        }
      }
    } else if (contentArea && contentArea.parentElement) {
      if (existing.parentElement !== contentArea.parentElement) {
        contentArea.parentElement.appendChild(existing);
      }
    } else if (document.body && existing.parentElement !== document.body) {
      document.body.appendChild(existing);
    }
  }

  // Genel Log kutusu fc-header-view icine baglanir
  mountMarketLogBox(headerContainer);
  return headerContainer;
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

  // fc-snipe-panel hub container icinde en sola baglanir
  if (panel && panel.parentElement !== hubContainer) {
    if (hubContainer.firstChild) {
      hubContainer.insertBefore(panel, hubContainer.firstChild);
    } else {
      hubContainer.appendChild(panel);
    }
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

  ensureHeaderContainer();
  ensureHubContainer();

  const contentArea = document.querySelector('.ut-navigation-container-view--content');
  if (contentArea) {
    contentArea.style.setProperty('display', 'none', 'important');
    eaContentHidden = true;
  }

  if (headerContainer) {
    headerContainer.style.setProperty('display', 'flex', 'important');
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

  if (headerContainer) {
    headerContainer.style.setProperty('display', 'none', 'important');
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

  ensureHeaderContainer();
  ensureHubContainer();
  syncPageVisibility();
}

export function getTabElement() {
  return tabEl;
}

export function getHubContainer() {
  return hubContainer;
}

export function getHeaderContainer() {
  return headerContainer;
}
