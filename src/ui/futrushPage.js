// ut-tab-bar-view icerisine FutRUSH sekmesi ekler ve ozel FutRUSH sayfa gorunumunu yonetir.
// Bagimliliklar: ui/icons, core/state, ui/panel/panel, ui/panel/panelTabs, ui/marketLogBox.

import { LOGO_SVG } from './icons.js';
import { state } from '../core/state.js';
import { panel, applyGeom } from './panel/panel.js';
import { renderPanelTabs } from './panel/panelTabs.js';
import { renderBotLogs } from './panel/tabs/logsTab.js';
import { renderMarketLogBox, openMarketLogBox, mountMarketLogBox } from './marketLogBox.js';

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
      border-radius: 6px !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
    }
    .fr-hub-side-col {
      display: flex;
      flex-direction: column;
      gap: 5px;
      width: 420px;
      flex: 0 0 420px;
      box-sizing: border-box;
    }
    .fr-bot-logs-panel {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      width: 420px !important;
      min-width: 420px !important;
      max-width: 420px !important;
      height: 380px !important;
      min-height: 380px !important;
      max-height: 380px !important;
      flex: 0 0 380px !important;
      background: rgba(21, 29, 41, 0.7);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 6px !important;
      box-sizing: border-box;
      padding: 10px;
      display: flex !important;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #e6f6f7;
    }
    .fr-hub-side-col .fr-market-log-box {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      width: 420px !important;
      min-width: 420px !important;
      max-width: 420px !important;
      height: 218px !important;
      min-height: 218px !important;
      max-height: 218px !important;
      flex: 0 0 218px !important;
      background: rgba(21, 29, 41, 0.7) !important;
      backdrop-filter: blur(8px) !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      border-radius: 6px !important;
      box-sizing: border-box !important;
      padding: 10px !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      color: #e6f6f7 !important;
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
  const existing = document.querySelector('.fr-header-log-btn');
  if (existing) existing.remove();
  return null;
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

  // Sag kolon: Ustte "Loglar" paneli (380px x 420px), 5px altinda fr-log-list / Genel Log (218px x 420px)
  let sideCol = hubContainer.querySelector('.fr-hub-side-col');
  if (!sideCol) {
    sideCol = document.createElement('div');
    sideCol.className = 'fr-hub-side-col';
    hubContainer.appendChild(sideCol);
  }
  if (panel && sideCol.previousElementSibling !== panel) {
    hubContainer.insertBefore(sideCol, panel.nextSibling);
  }

  // Ust panel: "Loglar" paneli (380px x 420px)
  let botLogsPanel = sideCol.querySelector('.fr-bot-logs-panel');
  if (!botLogsPanel) {
    botLogsPanel = document.createElement('div');
    botLogsPanel.className = 'fr-bot-logs-panel';
    sideCol.appendChild(botLogsPanel);
  }
  renderBotLogs(botLogsPanel);

  // Alt panel: fr-log-list / Genel Log (218px x 420px, 5px altta)
  mountMarketLogBox(sideCol);
  const logBox = sideCol.querySelector('.fr-market-log-box');
  if (botLogsPanel && logBox && logBox.previousElementSibling !== botLogsPanel) {
    sideCol.insertBefore(logBox, botLogsPanel.nextSibling);
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

  const botLogsPanel = hubContainer.querySelector('.fr-bot-logs-panel');
  if (botLogsPanel) {
    renderBotLogs(botLogsPanel);
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
  syncPageVisibility();
}

export function getTabElement() {
  return tabEl;
}

export function getHubContainer() {
  return hubContainer;
}

export function getHeaderLogButton() {
  return null;
}
