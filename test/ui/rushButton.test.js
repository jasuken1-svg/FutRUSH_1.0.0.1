import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const { pageWindow, findLowestMarketPrice } = vi.hoisted(() => ({
  pageWindow: {},
  findLowestMarketPrice: vi.fn()
}));

vi.mock('../../src/utils/dom.js', () => ({ pageWindow }));
vi.mock('../../src/ea/lowestMarketPrice.js', () => ({ findLowestMarketPrice }));

class UTItemView {
  constructor() {
    this.__root = document.createElement('div');
    this.__root.className = 'listFUTItem';
    this.data = null;
  }
  render() { return this.__root; }
  setItemData(data) { this.data = data; }
}

let dom;
let initRushButton;
let destroyRushButton;

beforeEach(async () => {
  vi.resetModules();
  findLowestMarketPrice.mockReset();
  dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://futrush.test' });
  globalThis.document = dom.window.document;
  pageWindow.UTItemView = UTItemView;
  ({ initRushButton, destroyRushButton } = await import('../../src/ui/rushButton.js'));
  initRushButton();
});

afterEach(() => {
  destroyRushButton();
  dom.window.close();
  delete globalThis.document;
  delete pageWindow.UTItemView;
});

describe('RUSHbuttonv1', () => {
  it('render ve setItemData asamasinda guncel kart kimligini baglar', () => {
    const view = new UTItemView();
    view.render();
    view.setItemData({ definitionId: 111, type: 'player', category: 'any' });
    const btn = view.__root.querySelector('.fr-rush-btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('RUSHbuttonv1');
    expect(btn.dataset.defId).toBe('111');

    view.setItemData({ definitionId: 222, type: 'player', category: 'any' });
    expect(btn.dataset.defId).toBe('222');
    expect(btn.textContent).toBe('RUSHbuttonv1');
  });

  it('kart tiklamasini yalitir ve bulunan fiyati gosterir', async () => {
    findLowestMarketPrice.mockResolvedValue({ ok: true, extinct: false, price: 5400, count: 3, slices: [{ price: 5400, count: 3 }] });
    const view = new UTItemView();
    view.render();
    view.setItemData({ definitionId: 333, type: 'player', category: 'any' });
    const btn = view.__root.querySelector('.fr-rush-btn');
    let parentClicks = 0;
    view.__root.addEventListener('click', () => { parentClicks += 1; });
    const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    btn.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(parentClicks).toBe(0);
    await vi.waitFor(() => expect(btn.textContent).toBe(Number(5400).toLocaleString('tr-TR') + ' ×3'));
    expect(findLowestMarketPrice).toHaveBeenCalledWith(
      expect.objectContaining({ definitionId: 333 }),
      expect.any(Object)
    );
  });

  it('bos pazarda EXTINCT, hatada ERROR gosterir', async () => {
    const view = new UTItemView();
    view.render();
    view.setItemData({ definitionId: 444, type: 'player' });
    const btn = view.__root.querySelector('.fr-rush-btn');

    findLowestMarketPrice.mockResolvedValueOnce({ ok: true, extinct: true, price: null, count: 0, slices: [] });
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(btn.textContent).toBe('EXTINCT'));

    view.setItemData({ definitionId: 445, type: 'player' });
    findLowestMarketPrice.mockResolvedValueOnce({ ok: false, error: { message: 'fail' } });
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(btn.textContent).toBe('ERROR'));
  });
});
