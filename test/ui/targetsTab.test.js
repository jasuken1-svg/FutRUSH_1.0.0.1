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
    expect(secondCard.querySelector('.fr-target-icons')).toBeNull();
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

  it('uses the next price tier when stepping across thresholds', () => {
    state.targets = [
      { id: 'threshold', name: 'Threshold', rating: 90, price: 950, searches: 3, buyNow: 950 }
    ];
    const content = document.createElement('div');
    renderTargetContent(content);

    const card = content.querySelector('.fr-target-card');
    const increase = card.querySelector('[aria-label="SATIN AL artır"]');
    const decrease = card.querySelector('[aria-label="SATIN AL azalt"]');
    const value = card.querySelector('[aria-label="SATIN AL değeri"]');

    increase.click();
    expect(state.targets[0].buyNow).toBe(1000);
    increase.click();
    expect(state.targets[0].buyNow).toBe(1100);
    decrease.click();
    expect(state.targets[0].buyNow).toBe(1000);
    decrease.click();
    expect(state.targets[0].buyNow).toBe(950);
    expect(value.value).toBe('950');
  });

  it('rounds manually entered prices down to the EA tier and allows exact search counts', () => {
    state.targets = [
      { id: 'manual', name: 'Manual', rating: 90, price: 1000, searches: 3, buyNow: 1000 }
    ];
    const content = document.createElement('div');
    renderTargetContent(content);
    const card = content.querySelector('.fr-target-card');
    const searches = card.querySelector('[aria-label="TUR SAYISI değeri"]');
    const buyNow = card.querySelector('[aria-label="SATIN AL değeri"]');

    searches.value = '12';
    searches.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    buyNow.value = '2111';
    buyNow.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(state.targets[0]).toMatchObject({ searches: 12, buyNow: 2100 });
    expect(buyNow.value).toBe('2.100');

    buyNow.value = '111111';
    buyNow.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(state.targets[0].buyNow).toBe(111000);
    expect(buyNow.value).toBe('111.000');
  });

  it('rejects invalid manual values and restores the saved value', () => {
    state.targets = [
      { id: 'invalid', name: 'Invalid', rating: 90, price: 1000, searches: 3, buyNow: 1000 }
    ];
    const content = document.createElement('div');
    renderTargetContent(content);
    const input = content.querySelector('[aria-label="TUR SAYISI değeri"]');

    input.value = '0';
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(state.targets[0].searches).toBe(3);
    expect(input.value).toBe('3');
    expect(state.targetStatus).toMatchObject({ type: 'error' });
  });

  it('renders versionLabel badge and thumb wrap in target card', () => {
    state.targets = [
      {
        id: 't1',
        name: 'Michael Olise',
        rating: 90,
        price: 50000,
        buyNow: 50000,
        searches: 3,
        versionLabel: 'Trailblazers',
        playerImageUrl: 'https://cdn.futbin.com/players/p67246800.png',
        promoImageUrl: 'https://cdn.futbin.com/cards/hd/44_card.png'
      }
    ];
    const content = document.createElement('div');
    renderTargetContent(content);

    const card = content.querySelector('.fr-target-card');
    const badge = card.querySelector('.fr-target-version-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('Trailblazers');

    const thumbWrap = card.querySelector('.fr-target-thumb-wrap');
    expect(thumbWrap).not.toBeNull();
    const thumbBg = thumbWrap.querySelector('.fr-target-thumb-bg');
    expect(thumbBg).not.toBeNull();
    const thumbImg = thumbWrap.querySelector('.fr-target-thumb');
    expect(thumbImg).not.toBeNull();
  });

  it('renders authentic EA card structure with stats, rating, position, and badges', () => {
    state.targets = [
      {
        id: 'yamal-totw',
        name: 'Lamine Yamal',
        commonName: 'Lamine Yamal',
        rating: 91,
        position: 'RW',
        price: 2750000,
        buyNow: 2750000,
        searches: 3,
        versionLabel: 'TOTW',
        isHolo: true,
        stats: { pac: 87, sho: 85, pas: 88, dri: 94, def: 40, phy: 63 },
        nationImageUrl: 'https://cdn.futbin.com/content/fifa27/img/nation/45.png',
        clubImageUrl: 'https://cdn.futbin.com/content/fifa27/img/clubs/dark/241.png',
        leagueImageUrl: 'https://cdn.futbin.com/content/fifa25/img/league/53.png',
        playerImageUrl: 'https://cdn.futbin.com/players/p50609291.png',
        promoImageUrl: 'https://cdn.futbin.com/cards/hd/3_card.png'
      }
    ];
    const content = document.createElement('div');
    renderTargetContent(content);

    const eaCard = content.querySelector('.fr-ea-card');
    expect(eaCard).not.toBeNull();
    expect(eaCard.querySelector('.fr-ea-card-rating')?.textContent).toBe('91');
    expect(eaCard.querySelector('.fr-ea-card-pos')?.textContent).toBe('RW');
    expect(eaCard.querySelector('.fr-ea-card-name')?.textContent).toBe('Lamine Yamal');
    expect(eaCard.querySelector('.fr-card-holo-shimmer')).not.toBeNull();

    const stats = eaCard.querySelectorAll('.fr-ea-stat');
    expect(stats.length).toBe(6);
    expect(stats[0].textContent).toContain('87');
    expect(stats[0].textContent).toContain('PAC');

    const crests = eaCard.querySelectorAll('.fr-ea-crest');
    expect(crests.length).toBe(3);
  });
});
