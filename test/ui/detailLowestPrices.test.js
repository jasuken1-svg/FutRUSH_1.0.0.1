import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

let dom;
let originalWindow;
let originalDocument;
let originalUnsafeWindow;
let internals;

beforeAll(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://futrush.test' });
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  originalUnsafeWindow = Object.getOwnPropertyDescriptor(globalThis, 'unsafeWindow');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.unsafeWindow = dom.window;
  ({ __internals__: internals } = await import('../../src/ui/ea/detailLowestPrices.js'));
});

afterAll(() => {
  dom.window.close();
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete globalThis.window;
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else delete globalThis.document;
  if (originalUnsafeWindow) Object.defineProperty(globalThis, 'unsafeWindow', originalUnsafeWindow);
  else delete globalThis.unsafeWindow;
});

describe('detail lowest-price selected card resolution', () => {
  it('recognizes definition-id-only EA card models', () => {
    const item = { definitionId: 123456, rating: 88 };
    expect(internals.isItemLike(item)).toBe(true);
    expect(internals.isItemLike({ definitionId: 0, rating: 88 })).toBe(false);
    expect(internals.findItemEntityInObject({ props: { data: { item } } }, new WeakSet(), 0)).toBe(item);
  });

  it('does not treat the first market search result as the selected card', () => {
    window.services = { Item: { _lastSearchResult: [{ definitionId: 246810 }] } };
    expect(internals.resolveSelectedCard()).toBeNull();
    delete window.services;
  });

  it('resolves a card ID from unclassified detail-panel ancestors', () => {
    const panel = document.createElement('section');
    panel.setAttribute('data-definition-id', '987654');
    const wrapper = document.createElement('div');
    const group = document.createElement('div');
    group.className = 'ut-button-group';
    wrapper.appendChild(group);
    panel.appendChild(wrapper);
    document.body.appendChild(panel);

    expect(internals.readCardIdsFromDom(group)).toEqual({ definitionId: 987654, tradeId: 0 });
    expect(internals.computeTargetForGroup(group)).toEqual({ itemEntity: null, defId: 987654 });
  });

  it('captures the clicked card and uses it when the detail panel has no card metadata', () => {
    const card = document.createElement('div');
    card.setAttribute('data-definition-id', '765432');
    const image = document.createElement('img');
    card.appendChild(image);
    document.body.appendChild(card);

    expect(internals.captureSelectedCardFromElement(image)).toBe(true);
    const group = document.createElement('div');
    group.className = 'ut-button-group';
    document.body.appendChild(group);
    expect(internals.computeTargetForGroup(group)).toMatchObject({ itemEntity: null, defId: 765432 });
  });

  it('captures the selected EA item from a clicked React card component', () => {
    const card = document.createElement('div');
    const item = { definitionId: 345678, rating: 91 };
    card['__reactFiber$test'] = {
      memoizedProps: { cardViewModel: { item } },
      return: null
    };

    expect(internals.captureSelectedCardFromElement(card)).toBe(true);
  });

  it('resolves the clicked EA card from React DOM props when no fiber is exposed', () => {
    const card = document.createElement('div');
    const item = { definitionId: 567890, rating: 90 };
    card['__reactProps$test'] = { cardViewModel: { item } };

    expect(internals.findItemInReactProps(card)).toBe(item);
    expect(internals.captureSelectedCardFromElement(card)).toBe(true);
  });
});
