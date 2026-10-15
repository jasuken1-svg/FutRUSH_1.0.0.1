import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

let dom;
let originalWindow;
let originalDocument;
let originalUnsafeWindow;
let state;
let renderTargetContent;

beforeAll(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://futrush.test' });
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  originalUnsafeWindow = Object.getOwnPropertyDescriptor(globalThis, 'unsafeWindow');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.unsafeWindow = dom.window;

  ({ state } = await import('../../src/core/state.js'));
  ({ renderTargetContent } = await import('../../src/ui/panel/tabs/targetsTab.js'));
});

afterAll(() => {
  state.targets = [];
  dom.window.close();
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete globalThis.window;
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else delete globalThis.document;
  if (originalUnsafeWindow) Object.defineProperty(globalThis, 'unsafeWindow', originalUnsafeWindow);
  else delete globalThis.unsafeWindow;
});

describe('player target controls', () => {
  it('updates a price in place and preserves list position and scroll', () => {
    state.targets = [
      { id: 'first', name: 'First', rating: 90, price: 1000, searches: 3, buyNow: 1000 },
      { id: 'second', name: 'Second', rating: 91, price: 1500, searches: 3, buyNow: 1500 },
      { id: 'third', name: 'Third', rating: 92, price: 2000, searches: 3, buyNow: 2000 }
    ];
    const content = document.createElement('div');
    renderTargetContent(content);

    const list = content.querySelector('.fr-target-list');
    list.scrollTop = 90;
    const secondCard = list.querySelectorAll('.fr-target-card')[1];
    const groups = secondCard.querySelectorAll('.fr-target-controls > div');
    expect(groups[0].querySelector('.fr-target-control-title').textContent).toBe('TUR SAYISI');
    expect(groups[1].querySelector('.fr-target-control-title').textContent).toBe('SATIN AL');
    expect(groups[0].querySelector('.fr-target-control-title').nextElementSibling)
      .toBe(groups[0].querySelector('.fr-target-counter'));
    expect(groups[1].querySelector('.fr-target-control-title').nextElementSibling)
      .toBe(groups[1].querySelector('.fr-target-counter'));

    secondCard.querySelector('[aria-label="SATIN AL artır"]').click();

    expect(state.targets.map((target) => target.id)).toEqual(['first', 'second', 'third']);
    expect(state.targets[1].buyNow).toBeGreaterThan(1500);
    expect(content.querySelectorAll('.fr-target-card')[1]).toBe(secondCard);
    expect(content.querySelector('.fr-target-list').scrollTop).toBe(90);

    const increasedPrice = state.targets[1].buyNow;
    secondCard.querySelector('[aria-label="SATIN AL azalt"]').click();

    expect(state.targets[1].buyNow).toBeLessThan(increasedPrice);
    expect(state.targets.map((target) => target.id)).toEqual(['first', 'second', 'third']);
    expect(content.querySelectorAll('.fr-target-card')[1]).toBe(secondCard);
    expect(content.querySelector('.fr-target-list').scrollTop).toBe(90);
  });
});
