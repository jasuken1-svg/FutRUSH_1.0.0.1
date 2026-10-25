import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

    expect(internals.readCardIdsFromDom(group)).toEqual({ definitionId: 987654, baseId: 0, tradeId: 0 });
    expect(internals.computeTargetForGroup(group)).toEqual({ itemEntity: null, defId: 987654 });
  });

  it('resolves resource IDs like the target lowest-price button and refreshes the cached target', () => {
    const group = document.createElement('div');
    group.className = 'ut-button-group';
    group.setAttribute('data-resource-id', String(0x12012345));
    document.body.appendChild(group);

    expect(internals.resolveDetailTarget(group)).toEqual({
      itemEntity: null,
      defId: 0x12012345
    });
  });

  it('uses the active EA ViewController quick-list item before global state', () => {
    const item = { resourceId: 0x01012345, type: 'player' };
    window.getAppMain = () => ({
      getRootViewController: () => ({
        getPresentedViewController: () => ({
          getCurrentViewController: () => ({
            _Controller: {
              _rightController: {
                _currentController: { _quickListPanel: { _item: item } }
              }
            }
          })
        })
      })
    });

    expect(internals.resolveItemFromEaViewController()).toBe(item);
    expect(internals.getItemEntityDefId(item)).toBe(0x01012345);
    expect(internals.getItemEntityBaseId(item)).toBe(0x012345);
    delete window.getAppMain;
  });

  it('keeps an asset ID as a base ID instead of treating it as an exact definition ID', () => {
    const item = { assetId: 0x012345, type: 'player' };
    expect(internals.isItemLike(item)).toBe(true);
    expect(internals.getItemEntityDefId(item)).toBe(0);
    expect(internals.getItemEntityBaseId(item)).toBe(0x012345);
  });

  it('resolves a selected squad slot through EA game-tab and detail navigation controllers', () => {
    const item = { definitionId: 0x01045678, type: 'player' };
    const slot = { _item: item };
    const detailController = { viewmodel: { current: () => slot } };
    const detailNavigation = { currentController: detailController };
    const squadController = {
      rightController: detailNavigation,
      _itemDetailController: detailNavigation,
      _squad: { _players: [slot] }
    };
    const gameNavigation = { currentController: squadController };
    const gameTabs = { getCurrentViewController: () => gameNavigation };
    window.getAppMain = () => ({
      getRootViewController: () => ({
        getPresentedViewController: () => gameTabs
      })
    });

    expect(internals.resolveItemFromEaViewController()).toBe(item);
    delete window.getAppMain;
  });

  it('resolves a selected UTItemEntity from the active list controller index', () => {
    const item = { definitionId: 0x01023456, type: 'player' };
    const list = document.createElement('ul');
    list.className = 'paginated-item-list';
    list.innerHTML = '<li class="listFUTItem"></li><li class="listFUTItem"><span></span></li>';
    document.body.appendChild(list);
    const clicked = list.querySelectorAll('li')[1].firstElementChild;
    window.getAppMain = () => ({
      getRootViewController: () => ({
        getPresentedViewController: () => ({
          getCurrentViewController: () => ({
            _leftController: { _viewmodel: { items: [{ definitionId: 10 }, item] } }
          })
        })
      })
    });

    expect(internals.resolveItemFromListIndex(clicked)).toBe(item);
    delete window.getAppMain;
  });

  it('resolves the selected squad item by slot index', () => {
    const item = { definitionId: 0x01034567, type: 'player' };
    const slot = document.createElement('div');
    slot.className = 'ut-squad-slot-view';
    slot.setAttribute('data-slot-id', '2');
    const child = document.createElement('span');
    slot.appendChild(child);
    document.body.appendChild(slot);
    const controller = { _squadController: { _squad: { _players: [null, null, { _item: item }] } } };

    expect(internals.resolveSquadSlotItem(child, controller)).toBe(item);
  });

  it('reads the full resource ID and keeps asset ID separate as a base ID', () => {
    const group = document.createElement('div');
    group.setAttribute('data-resource-id', '16849733');
    group.setAttribute('data-asset-id', '1234567');

    expect(internals.readCardIdsFromDom(group)).toEqual({
      definitionId: 16849733,
      baseId: 1234567,
      tradeId: 0
    });
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

  it('keeps the clicked card available to the detail button after the panel settles', () => {
    vi.useFakeTimers();
    const card = document.createElement('div');
    card.className = 'listFUTItem';
    card.setAttribute('data-definition-id', '876543');
    const image = document.createElement('img');
    card.appendChild(image);
    document.body.appendChild(card);
    internals.captureCardFromClick({
      target: image,
      composedPath: () => [image, card, document.body, document, window]
    });
    vi.advanceTimersByTime(10000);

    const group = document.createElement('div');
    group.className = 'ut-button-group';
    document.body.appendChild(group);
    expect(internals.resolveDetailTarget(group)).toMatchObject({ itemEntity: null, defId: 876543 });
    vi.useRealTimers();
  });

  it('resolves the clicked EA card from React DOM props when no fiber is exposed', () => {
    const card = document.createElement('div');
    const item = { definitionId: 567890, rating: 90 };
    card['__reactProps$test'] = { cardViewModel: { item } };

    expect(internals.findItemInReactProps(card)).toBe(item);
    expect(internals.captureSelectedCardFromElement(card)).toBe(true);
  });

  it('updates Quick List DOM inputs, events, and the active EA quick-list controller', () => {
    const panel = document.createElement('section');
    panel.className = 'ut-quick-list-panel-view';
    const group = document.createElement('div');
    group.className = 'ut-button-group';
    const start = document.createElement('input');
    const buyNow = document.createElement('input');
    start.className = 'numericInput';
    buyNow.className = 'numericInput';
    for (const input of [start, buyNow]) {
      input.getBoundingClientRect = () => ({ width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20 });
    }
    panel.append(group, start, buyNow);
    document.body.appendChild(panel);

    const controller = {
      setStartPrice: vi.fn(),
      setBuyNowPrice: vi.fn()
    };
    window.getAppMain = () => ({
      getRootViewController: () => ({
        getPresentedViewController: () => ({
          getCurrentViewController: () => ({
            _rightController: { _currentController: { _quickListPanel: controller } }
          })
        })
      })
    });

    const startEvents = { input: 0, change: 0 };
    const buyNowEvents = { input: 0, change: 0 };
    for (const [input, counts] of [[start, startEvents], [buyNow, buyNowEvents]]) {
      input.addEventListener('input', () => { counts.input += 1; });
      input.addEventListener('change', () => { counts.change += 1; });
    }

    expect(internals.applyToQuickList(group, 1200)).toBe(true);
    expect(Number(buyNow.value)).toBe(1200);
    expect(Number(start.value)).toBeGreaterThan(0);
    expect(Number(start.value)).toBeLessThan(1200);
    expect(startEvents).toEqual({ input: 1, change: 1 });
    expect(buyNowEvents).toEqual({ input: 1, change: 1 });
    expect(controller.setBuyNowPrice).toHaveBeenCalledWith(1200);
    expect(controller.setStartPrice).toHaveBeenCalledWith(Number(start.value));
    delete window.getAppMain;
  });
});
