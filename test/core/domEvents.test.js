import { beforeAll, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('domEvents', () => {
  let dom;
  let initDomEvents;

  beforeAll(async () => {
    dom = new JSDOM(
      '<!doctype html><html><body>' +
        '<div id="fr-hub-view"><div class="scroll-inner"></div></div>' +
        '<div class="regular-content"></div>' +
      '</body></html>',
      { url: 'https://futrush.test' }
    );
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    globalThis.MutationObserver = dom.window.MutationObserver;

    ({ initDomEvents } = await import('../../src/core/domEvents.js'));
    initDomEvents();
  });

  it('prevents default on mousedown, pointerdown, and auxclick when middle mouse button (button 1) is clicked', () => {
    const target = document.querySelector('.regular-content');

    const middlePointerEvent = new dom.window.MouseEvent('pointerdown', { button: 1, cancelable: true, bubbles: true });
    target.dispatchEvent(middlePointerEvent);
    expect(middlePointerEvent.defaultPrevented).toBe(true);

    const middleMouseEvent = new dom.window.MouseEvent('mousedown', { button: 1, cancelable: true, bubbles: true });
    target.dispatchEvent(middleMouseEvent);
    expect(middleMouseEvent.defaultPrevented).toBe(true);

    const middleAuxEvent = new dom.window.MouseEvent('auxclick', { button: 1, cancelable: true, bubbles: true });
    target.dispatchEvent(middleAuxEvent);
    expect(middleAuxEvent.defaultPrevented).toBe(true);
  });

  it('allows default behavior for left click (button 0) and right click (button 2)', () => {
    const target = document.querySelector('.regular-content');

    const leftEvent = new dom.window.MouseEvent('mousedown', { button: 0, cancelable: true, bubbles: true });
    target.dispatchEvent(leftEvent);
    expect(leftEvent.defaultPrevented).toBe(false);

    const rightEvent = new dom.window.MouseEvent('mousedown', { button: 2, cancelable: true, bubbles: true });
    target.dispatchEvent(rightEvent);
    expect(rightEvent.defaultPrevented).toBe(false);
  });
});
