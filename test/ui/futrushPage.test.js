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

  it('opens FutRUSH page, updates navbar title to FutRUSH Panel, places header log icon, and sets panel on the left in hub view', () => {
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

    // Header log icon button exists and has tooltip
    const logBtn = futrushPage.getHeaderLogButton();
    expect(logBtn).toBeTruthy();
    expect(logBtn.style.display).toBe('inline-flex');
    expect(logBtn.title).toBe('Genel Logları göster');
    expect(logBtn.textContent).toContain('Genel Logları göster');

    // Hub container contains fc-snipe-panel as first child on the left
    const hub = futrushPage.getHubContainer();
    expect(hub).toBeTruthy();
    expect(hub.style.display).toBe('flex');
    const panelEl = hub.querySelector('#fc-snipe-panel');
    expect(panelEl).toBeTruthy();
    expect(hub.children[0]).toBe(panelEl);

    // Genel Log floating box exists with draggable head and resize handle
    const logBox = document.querySelector('.fr-market-log-box');
    expect(logBox).toBeTruthy();
    expect(logBox.textContent).toContain('Genel Log');
    expect(logBox.querySelector('.fr-log-resize-handle')).toBeTruthy();
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
});
