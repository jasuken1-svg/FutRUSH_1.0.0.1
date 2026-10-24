import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  injectRushButtonIntoPanel,
  findActionButtons,
  formatResult,
  installRushActionButtons,
  syncRushActionButtons,
  resetPatchFlagForTesting,
  BTN_CLASS,
  IDLE_TEXT
} from '../../src/ui/rushButton.js';
import { state } from '../../src/core/state.js';

describe('rushButton in Action Panel', () => {
  let dom;
  let origWindow;
  let origDocument;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
    origWindow = globalThis.window;
    origDocument = globalThis.document;
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    state.botRunning = false;
    resetPatchFlagForTesting();
  });

  afterEach(() => {
    globalThis.window = origWindow;
    globalThis.document = origDocument;
    vi.restoreAllMocks();
  });

  it('formatResult outputs expected text without misleading exactness', () => {
    expect(formatResult({ status: 'EXTINCT' })).toBe('EXTINCT');
    expect(formatResult({ status: 'ERROR' })).toBe('ERROR');
    expect(formatResult({ status: 'OK', price: 45000, count: 2 })).toBe('🪙 45.000 (x2)');
    expect(formatResult({ status: 'OK', price: 12000, count: 20 })).toBe('🪙 12.000 (x20+)');
  });

  it('findActionButtons identifies Compare Price and Quick Sell buttons', () => {
    const container = document.createElement('div');

    const btn1 = document.createElement('button');
    btn1.className = 'btn-standard';
    btn1.textContent = 'Send to Transfer List';

    const btn2 = document.createElement('button');
    btn2.className = 'btn-standard compare';
    btn2.textContent = 'Compare Price';

    const btn3 = document.createElement('button');
    btn3.className = 'btn-standard QuickSell';
    btn3.textContent = 'Quick Sell 650';

    container.append(btn1, btn2, btn3);

    const { compareBtn, quickSellBtn } = findActionButtons(container);
    expect(compareBtn).toBe(btn2);
    expect(quickSellBtn).toBe(btn3);
  });

  it('does NOT inject button if neither Compare Price nor Quick Sell is found', () => {
    const container = document.createElement('div');
    const group = document.createElement('div');
    group.className = 'ut-button-group';
    const otherBtn = document.createElement('button');
    otherBtn.textContent = 'Send to Club';
    group.appendChild(otherBtn);
    container.appendChild(group);

    injectRushButtonIntoPanel(container);
    expect(container.querySelectorAll('.' + BTN_CLASS).length).toBe(0);
  });

  it('does NOT inject button inside list item cards', () => {
    const listCard = document.createElement('li');
    listCard.className = 'listFUTItem selected';
    const group = document.createElement('div');
    group.className = 'ut-button-group';
    const compareBtn = document.createElement('button');
    compareBtn.textContent = 'Compare Price';
    group.appendChild(compareBtn);
    listCard.appendChild(group);
    document.body.appendChild(listCard);

    injectRushButtonIntoPanel(group);
    expect(listCard.querySelectorAll('.' + BTN_CLASS).length).toBe(0);
  });

  it('injects button exactly between Compare Price and Quick Sell with matching styles', () => {
    const container = document.createElement('div');
    const group = document.createElement('div');
    group.className = 'ut-button-group';

    const compareBtn = document.createElement('button');
    compareBtn.className = 'btn-standard call-to-action';
    compareBtn.textContent = 'Compare Price';

    const quickSellBtn = document.createElement('button');
    quickSellBtn.className = 'btn-standard';
    quickSellBtn.textContent = 'Quick Sell';

    group.append(compareBtn, quickSellBtn);
    container.appendChild(group);

    const view = {
      getRootElement: () => container,
      _item: { definitionId: 777 }
    };

    injectRushButtonIntoPanel(view);

    const rushBtn = group.querySelector('.' + BTN_CLASS);
    expect(rushBtn).not.toBeNull();
    expect(rushBtn.textContent).toBe(IDLE_TEXT);

    // Konum: Compare Price'ın hemen ardında, Quick Sell'in hemen önünde
    expect(compareBtn.nextElementSibling).toBe(rushBtn);
    expect(rushBtn.nextElementSibling).toBe(quickSellBtn);

    // Stil: Compare Price'ın sınıflarını miras almış olmalı
    expect(rushBtn.className).toContain('btn-standard');
    expect(rushBtn.className).toContain('call-to-action');
    expect(rushBtn.className).toContain(BTN_CLASS);
  });

  it('handles click event without being blocked by mousedown', async () => {
    const container = document.createElement('div');
    const group = document.createElement('div');
    group.className = 'ut-button-group';
    const compareBtn = document.createElement('button');
    compareBtn.textContent = 'Compare Price';
    group.appendChild(compareBtn);
    container.appendChild(group);

    const view = {
      getRootElement: () => container,
      _item: { definitionId: 555 }
    };

    const mockSearch = vi.fn().mockResolvedValue({ status: 'OK', price: 3500, count: 1 });
    injectRushButtonIntoPanel(view, {
      finderDeps: {
        services: {
          Item: {
            clearTransferMarketCache: vi.fn(),
            searchTransferMarket: vi.fn()
          }
        }
      }
    });

    const rushBtn = group.querySelector('.' + BTN_CLASS);
    expect(rushBtn).not.toBeNull();

    // Browser standard: mousedown then click
    rushBtn.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }));
    rushBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    // Buton tıklamayı alıp 'Searching...' durumuna geçmeli
    expect(rushBtn.textContent).toContain('Searching');
  });

  it('cleans up rogue buttons from list cards in syncRushActionButtons', () => {
    const card = document.createElement('li');
    card.className = 'listFUTItem';
    const rogueBtn = document.createElement('button');
    rogueBtn.className = BTN_CLASS;
    card.appendChild(rogueBtn);
    document.body.appendChild(card);

    expect(document.querySelectorAll('.' + BTN_CLASS).length).toBe(1);
    syncRushActionButtons();
    expect(document.querySelectorAll('.' + BTN_CLASS).length).toBe(0);
  });
});
