import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

describe('futrushPage', () => {
  let dom;
  let futrushPage;
  let state;

  beforeAll(async () => {
    dom = new JSDOM(
      '<!doctype html><html><head></head><body>' +
        '<div class="ut-navigation-container-view">' +
          '<div class="ut-navigation-bar-view navbar-style-landscape currency-purchase">' +
            '<h1 class="title">Home</h1>' +
          '</div>' +
          '<div class="ut-navigation-container-view--content"><div>EA View Content</div></div>' +
        '</div>' +
        '<div class="ut-tab-bar-view game-navigation">' +
          '<nav class="ut-tab-bar">' +
            '<button class="ut-tab-bar-item icon-home"><span>Home</span></button>' +
            '<button class="ut-tab-bar-item icon-squad"><span>Squads</span></button>' +
            '<button class="ut-tab-bar-item icon-sbc"><span>SBC</span></button>' +
            '<button class="ut-tab-bar-item icon-evolution"><span>Evolutions</span></button>' +
            '<button class="ut-tab-bar-item icon-transfer selected"><span>Transfers</span></button>' +
          '</nav>' +
        '</div>' +
      '</body></html>',
      { url: 'https://futrush.test' }
    );
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;

    ({ state } = await import('../../src/core/state.js'));
    const { initPanel } = await import('../../src/ui/panel/panel.js');
    initPanel();
    futrushPage = await import('../../src/ui/futrushPage.js');
    futrushPage.initFutrushPage();
  });

  beforeEach(() => {
    futrushPage.closeFutrushPage();
  });

  it('inserts FutRUSH tab strictly between SBC and Evolutions', () => {
    futrushPage.placeFutrushTab();

    const nav = document.querySelector('nav.ut-tab-bar');
    const items = Array.from(nav.querySelectorAll('.ut-tab-bar-item'));
    const sbcIndex = items.findIndex((i) => /icon-sbc/i.test(i.className));
    const futrushIndex = items.findIndex((i) => i.classList.contains('fr-tab-bar-item'));
    const evoIndex = items.findIndex((i) => /icon-evolution/i.test(i.className));

    expect(futrushIndex).toBeGreaterThan(sbcIndex);
    expect(futrushIndex).toBeLessThan(evoIndex);
    expect(futrushIndex).toBe(sbcIndex + 1);
    expect(evoIndex).toBe(futrushIndex + 1);

    const tab = items[futrushIndex];
    expect(tab.textContent).toContain('FutRUSH');
    expect(tab.querySelector('.fr-tab-icon')).toBeTruthy();
  });

  it('opens FutRUSH page, updates navbar title to FutRUSH Panel, separates Loglar and Genel Log into side col with 6px radius, and removes header log and transfer logo buttons', () => {
    futrushPage.placeFutrushTab();
    futrushPage.openFutrushPage();

    expect(state.futrushPageActive).toBe(true);

    const tab = futrushPage.getTabElement();
    expect(tab.classList.contains('selected')).toBe(true);

    const transferTab = document.querySelector('.icon-transfer');
    expect(transferTab.classList.contains('selected')).toBe(false);

    // Navbar title updated to FutRUSH Panel
    const navTitle = document.querySelector('.ut-navigation-bar-view .title');
    expect(navTitle.textContent).toBe('FutRUSH Panel');

    const eaContent = document.querySelector('.ut-navigation-container-view--content');
    expect(eaContent.style.display).toBe('none');

    // Header log button ("Genel Logları göster") is completely removed
    const logBtn = futrushPage.getHeaderLogButton();
    expect(logBtn).toBeNull();
    expect(document.querySelector('.fr-header-log-btn')).toBeNull();

    // Transfer market logo button is completely removed
    expect(document.querySelector('.fc-snipe-logo-btn')).toBeNull();

    // Hub container contains fc-snipe-panel as first child on the left and sideCol as second child
    const hub = futrushPage.getHubContainer();
    expect(hub).toBeTruthy();
    expect(hub.style.display).toBe('flex');
    const panelEl = hub.querySelector('#fc-snipe-panel');
    expect(panelEl).toBeTruthy();
    expect(hub.children[0]).toBe(panelEl);

    // fc-snipe-panel has only 2 tabs: Oyuncu Hedefleri and Ayarlar (Loglar tab separated)
    const panelTabs = Array.from(panelEl.querySelectorAll('.fc-snipe-tab')).map((t) => t.textContent);
    expect(panelTabs).toEqual(['Oyuncu Hedefleri', 'Ayarlar']);
    expect(panelTabs).not.toContain('Loglar');

    // Side column is placed 15px to the right of fc-snipe-panel
    const sideCol = hub.querySelector('.fr-hub-side-col');
    expect(sideCol).toBeTruthy();
    expect(hub.children[1]).toBe(sideCol);
    expect(panelEl.nextElementSibling).toBe(sideCol);

    // Side column item 1: "Loglar" panel (380px x 420px)
    const botLogsPanel = sideCol.querySelector('.fr-bot-logs-panel');
    expect(botLogsPanel).toBeTruthy();
    expect(sideCol.children[0]).toBe(botLogsPanel);
    expect(botLogsPanel.querySelector('.fr-logs-header-title').textContent).toBe('Loglar');
    expect(botLogsPanel.querySelector('.fr-log-list')).toBeTruthy();

    // Side column item 2: fr-log-list / Genel Log (218px x 420px, 5px below)
    const logBox = sideCol.querySelector('.fr-market-log-box');
    expect(logBox).toBeTruthy();
    expect(sideCol.children[1]).toBe(logBox);
    expect(botLogsPanel.nextElementSibling).toBe(logBox);

    // Style checks for layout, dimensions and window radius
    const styleEl = document.getElementById('fr-futrush-page-style');
    expect(styleEl.textContent).toContain('gap: 15px');
    expect(styleEl.textContent).toContain('gap: 5px');
    expect(styleEl.textContent).toContain('height: 380px !important');
    expect(styleEl.textContent).toContain('width: 420px !important');
    expect(styleEl.textContent).toContain('height: 213px !important');
    expect(styleEl.textContent).toContain('border-radius: 6px !important');

    // Genel Loglar header and content checks
    expect(logBox.querySelector('.fr-logs-header-title').textContent).toBe('Genel Loglar');
    expect(logBox.querySelector('.fr-market-log-close-btn')).toBeNull();
    expect(logBox.querySelector('.fr-log-resize-corner')).toBeNull();
    expect(logBox.querySelector('.fr-market-log-undo-btn')).toBeNull();
    expect(logBox.textContent).toContain('Hedef ve işlem bildirimleri burada anlık olarak gösterilir.');

    // Loglar panel buttons are clickable and functional
    const filterBtns = botLogsPanel.querySelectorAll('.fr-log-filter-btn');
    expect(filterBtns.length).toBe(3);
    filterBtns[1].click();
    expect(filterBtns[1].classList.contains('active')).toBe(true);
    expect(filterBtns[0].classList.contains('active')).toBe(false);

    const clearBtn = botLogsPanel.querySelector('.fr-log-clear');
    expect(clearBtn).toBeTruthy();
    clearBtn.click();
  });

  it('closes FutRUSH page, hides hub view, and restores navbar title and EA content when an EA tab is clicked', () => {
    futrushPage.placeFutrushTab();
    futrushPage.openFutrushPage();

    const navTitle = document.querySelector('.ut-navigation-bar-view .title');
    expect(navTitle.textContent).toBe('FutRUSH Panel');

    const eaContent = document.querySelector('.ut-navigation-container-view--content');
    expect(eaContent.style.display).toBe('none');

    const transferTab = document.querySelector('.icon-transfer');
    transferTab.click();

    expect(state.futrushPageActive).toBe(false);
    const tab = futrushPage.getTabElement();
    expect(tab.classList.contains('selected')).toBe(false);

    const hub = futrushPage.getHubContainer();
    expect(hub.style.display).toBe('none');
    expect(eaContent.style.display).toBe('');

    // Navbar title restored
    expect(navTitle.textContent).toBe('Home');
  });

  it('manages market log box visibility via openMarketLogBox and closeMarketLogBox', async () => {
    const { openMarketLogBox, closeMarketLogBox } = await import('../../src/ui/marketLogBox.js');
    futrushPage.openFutrushPage();

    openMarketLogBox();
    const logBox = document.querySelector('.fr-market-log-box');
    expect(logBox.style.display).toBe('flex');

    closeMarketLogBox();
    expect(logBox.style.display).toBe('none');

    openMarketLogBox();
    expect(logBox.style.display).toBe('flex');
  });
});
