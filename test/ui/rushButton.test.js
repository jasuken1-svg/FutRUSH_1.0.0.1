import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  injectRushButtonIntoPanel,
  findActionButtons,
  formatResult,
  installRushActionButtons,
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

  it('resets button text when card changes in panel', () => {
    const container = document.createElement('div');
    const group = document.createElement('div');
    group.className = 'ut-button-group';
    container.appendChild(group);

    const view = {
      getRootElement: () => container,
      _item: { definitionId: 101 }
    };

    injectRushButtonIntoPanel(view);
    const btn = group.querySelector('.' + BTN_CLASS);
    btn.textContent = '🪙 50.000 (x2)';

    // Kart değişti
    view._item = { definitionId: 102 };
    injectRushButtonIntoPanel(view);

    expect(btn.textContent).toBe(IDLE_TEXT);
  });

  it('installRushActionButtons hooks render and setItem on action panel views', () => {
    const mockProto = {
      render: vi.fn(),
      setItem: vi.fn()
    };
    function MockDefaultActionPanel() {}
    MockDefaultActionPanel.prototype = mockProto;

    const mockWin = {
      UTDefaultActionPanelView: MockDefaultActionPanel
    };

    installRushActionButtons({ pageWindow: mockWin });

    expect(mockProto.render).not.toBe(vi.fn());
    const patchedRender = mockProto.render;
    installRushActionButtons({ pageWindow: mockWin });
    expect(mockProto.render).toBe(patchedRender);
  });
});
