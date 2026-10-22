import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('futrushPage', () => {
  let dom;
  let futrushPage;
  let state;

  beforeAll(async () => {
    dom = new JSDOM(
      '<!doctype html><html><head></head><body>' +
        '<div class="ut-navigation-container-view">' +
          '<div class="ut-navigation-bar-view"></div>' +
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

  it('opens FutRUSH page, hides EA content, and shows #fr-hub-view with panel and log box', () => {
    futrushPage.placeFutrushTab();
    futrushPage.openFutrushPage();

    expect(state.futrushPageActive).toBe(true);

    const tab = futrushPage.getTabElement();
    expect(tab.classList.contains('selected')).toBe(true);

    const transferTab = document.querySelector('.icon-transfer');
    expect(transferTab.classList.contains('selected')).toBe(false);

    const eaContent = document.querySelector('.ut-navigation-container-view--content');
    expect(eaContent.style.display).toBe('none');

    const hub = futrushPage.getHubContainer();
    expect(hub).toBeTruthy();
    expect(hub.style.display).toBe('flex');

    const panelEl = hub.querySelector('#fc-snipe-panel');
    const logBox = hub.querySelector('.fr-market-log-box');
    expect(panelEl).toBeTruthy();
    expect(logBox).toBeTruthy();

    // Verify ordering: panel is first child, logBox is second child (left-aligned)
    expect(hub.children[0]).toBe(panelEl);
    expect(hub.children[1]).toBe(logBox);
  });

  it('closes FutRUSH page and restores EA content when an EA tab is clicked', () => {
    futrushPage.placeFutrushTab();
    futrushPage.openFutrushPage();

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
  });
});
