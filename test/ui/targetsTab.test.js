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
      { id: 'manual', name: 'Manual', rating: 90, price: 100000, searches: 3, buyNow: 1000 }
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

  it('renders search toggle at top, clean profit, futbin price at bottom, and toggles inactive state', () => {
    state.targets = [
      {
        id: 'target-ux',
        name: 'Kylian Mbappe',
        rating: 91,
        price: 3000000,
        buyNow: 2500000,
        searches: 3,
        searchDisabled: false,
        priceUpdatedAt: Date.now() - 120000
      }
    ];
    const content = document.createElement('div');
    renderTargetContent(content);

    const card = content.querySelector('.fr-target-card');
    expect(card.classList.contains('is-search-inactive')).toBe(false);

    // 2a. Arama butonu ismin üstündeki top-bar içinde
    const topBar = card.querySelector('.fr-target-card-top');
    expect(topBar).not.toBeNull();
    const searchToggle = topBar.querySelector('.fr-target-search-toggle');
    expect(searchToggle).not.toBeNull();
    expect(searchToggle.textContent).toContain('Arama: Açık');

    // 2d. Sağ üstte son güncelleme
    const lastUpdate = topBar.querySelector('.fr-target-last-update');
    expect(lastUpdate).not.toBeNull();
    expect(lastUpdate.textContent).toContain('2 dakika önce');

    // 2b. Kâr bilgisi sadece Kâr: +... içerir; (-0.0%) veya FB içermez
    const profitEl = card.querySelector('.fr-target-profit');
    expect(profitEl).not.toBeNull();
    expect(profitEl.textContent).toMatch(/^Kâr:\s*[+-]?[\d.]+/);
    expect(profitEl.textContent).not.toContain('%');
    expect(profitEl.textContent).not.toContain('FB');

    // 2c. Sağ en altta FutBIN logosu ve fiyatı
    const futbinPrice = card.querySelector('.fr-target-futbin-price');
    expect(futbinPrice).not.toBeNull();
    expect(futbinPrice.querySelector('.fr-target-futbin-icon')).not.toBeNull();
    expect(futbinPrice.textContent.trim()).toBe('3.000.000');

    // 2e. Arama kapatılınca karta is-search-inactive sınıfı eklenir
    searchToggle.click();
    expect(state.targets[0].searchDisabled).toBe(true);
    expect(card.classList.contains('is-search-inactive')).toBe(true);
    expect(searchToggle.textContent).toContain('Arama: Kapalı');

    // Tekrar tıklanınca açılır
    searchToggle.click();
    expect(state.targets[0].searchDisabled).toBe(false);
    expect(card.classList.contains('is-search-inactive')).toBe(false);
    expect(searchToggle.textContent).toContain('Arama: Açık');
  });

  it('renders update prices button with coin icon and keeps action buttons at bottom', () => {
    state.targets = [
      { id: 't1', name: 'Rodri', rating: 91, price: 50000, buyNow: 45000, searches: 3 }
    ];
    const content = document.createElement('div');
    renderTargetContent(content);

    const updateBtn = content.querySelector('.fr-target-update-prices-btn');
    expect(updateBtn).not.toBeNull();
    expect(updateBtn.textContent).toContain('Güncelle 💰');

    const targetView = content.querySelector('.fr-target-view');
    expect(targetView).not.toBeNull();
    const lastChild = targetView.lastElementChild;
    expect(lastChild.classList.contains('fr-target-actions')).toBe(true);
    expect(lastChild.querySelector('.fr-target-save')).not.toBeNull();
    expect(lastChild.querySelector('.fr-target-load')).not.toBeNull();
  });

  it('calculates total target cards in summary bar as sum of searches and updates in real time', () => {
    state.targets = [
      { id: 'p1', name: 'Player 1', rating: 90, price: 10000, buyNow: 8500, searches: 2 },
      { id: 'p2', name: 'Player 2', rating: 91, price: 20000, buyNow: 18000, searches: 2 },
      { id: 'p3', name: 'Player 3', rating: 92, price: 30000, buyNow: 27000, searches: 2 }
    ];
    const content = document.createElement('div');
    renderTargetContent(content);

    const summaryBar = content.querySelector('.fr-target-summary-bar');
    expect(summaryBar).not.toBeNull();

    const summaryVals = summaryBar.querySelectorAll('.fr-summary-val');
    // Hedef: 2 + 2 + 2 = 6
    expect(summaryVals[0].textContent).toBe('6');
    // Gereken: 8500*2 + 18000*2 + 27000*2 = 17000 + 36000 + 54000 = 107.000
    expect(summaryVals[1].textContent).toBe('107.000');

    // First card: change searches from 2 to 3
    const firstCard = content.querySelectorAll('.fr-target-card')[0];
    const searchPlus = firstCard.querySelector('[aria-label="TUR SAYISI artır"]');
    searchPlus.click();

    expect(state.targets[0].searches).toBe(3);
    // Real-time update in summary bar without clicking "Güncelle 💰"
    expect(summaryBar.querySelectorAll('.fr-summary-val')[0].textContent).toBe('7');

    // Change buyNow on second card
    const secondCard = content.querySelectorAll('.fr-target-card')[1];
    const buyNowPlus = secondCard.querySelector('[aria-label="SATIN AL artır"]');
    buyNowPlus.click(); // 18000 + 250 = 18250

    expect(state.targets[1].buyNow).toBe(18250);
    // Gereken should update in real time: 8500*3 + 18250*2 + 27000*2 = 25500 + 36500 + 54000 = 116.000
    expect(summaryBar.querySelectorAll('.fr-summary-val')[1].textContent).toBe('116.000');
  });

  it('renders trend indicators (▲, ▼, ■) with price history tooltip', () => {
    state.targets = [
      {
        name: 'Player One',
        price: 50000,
        buyNow: 40000,
        priceTrend: 'same',
        priceHistory: [
          { price: 50000, at: Date.now() },
          { price: 50000, at: Date.now() - 60000 }
        ]
      }
    ];
    const content = dom.window.document.createElement('div');
    renderTargetContent(content);
    const sameIndicator = content.querySelector('.fr-target-trend-same');
    expect(sameIndicator).not.toBeNull();
    expect(sameIndicator.textContent).toBe('■');
    expect(sameIndicator.getAttribute('title')).toContain('Son Fiyat Güncellemeleri');
    expect(sameIndicator.getAttribute('title')).toContain('50.000 coin');
  });

  it('renders and interacts with the escalation controls on target cards', () => {
    state.targets = [
      {
        id: 'esc-target',
        name: 'Escalation Player',
        rating: 85,
        price: 20000,
        priceUpdatedAt: Date.now(),
        buyNow: 15000,
        searches: 3,
        escalation: {
          enabled: false,
          afterMinutes: 10,
          maxSteps: 3,
          steps: 0,
          activeMs: 0
        }
      }
    ];

    const content = dom.window.document.createElement('div');
    renderTargetContent(content);

    const card = content.querySelector('.fr-target-card');
    const toggleBtn = card.querySelector('.fr-escalation-toggle-btn');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.textContent).toContain('Kapalı');

    // Toggle ON
    toggleBtn.click();
    expect(state.targets[0].escalation.enabled).toBe(true);
    const newToggle = card.querySelector('.fr-escalation-toggle-btn');
    expect(newToggle.textContent).toContain('Açık');

    // Inputs should be visible
    const minInput = card.querySelector('.fr-escalation-field-input[min="5"]');
    const maxInput = card.querySelector('.fr-escalation-field-input[max="10"]');
    const errorEl = card.querySelector('.fr-escalation-inline-error');
    expect(minInput).not.toBeNull();
    expect(maxInput).not.toBeNull();
    expect(minInput.value).toBe('10');
    expect(maxInput.value).toBe('3');

    // Invalid input: minutes < 5
    minInput.value = '3';
    minInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(errorEl.hidden).toBe(false);
    expect(errorEl.textContent).toContain('en düşük 5');

    // Blur reverts to at least 5
    minInput.dispatchEvent(new dom.window.Event('blur', { bubbles: true }));
    expect(state.targets[0].escalation.afterMinutes).toBe(5);
    expect(minInput.value).toBe('5');
    expect(errorEl.hidden).toBe(true);

    // Invalid input: maxSteps > 10
    maxInput.value = '15';
    maxInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(errorEl.hidden).toBe(false);
    expect(errorEl.textContent).toContain('1 ile 10');

    // Blur clamps to 10
    maxInput.dispatchEvent(new dom.window.Event('blur', { bubbles: true }));
    expect(state.targets[0].escalation.maxSteps).toBe(10);
    expect(maxInput.value).toBe('10');
    expect(errorEl.hidden).toBe(true);

    // Test with steps applied: preview and badges
    state.targets[0].escalation.steps = 2;
    renderTargetContent(content);

    const updatedCard = content.querySelector('.fr-target-card');
    const preview = updatedCard.querySelector('.fr-escalation-preview');
    expect(preview.textContent).toContain('15.000 → 15.500 (+2)');

    const stepBadge = updatedCard.querySelector('.fr-escalation-badge-step');
    expect(stepBadge).not.toBeNull();
    expect(stepBadge.textContent).toBe('+2 basamak');

    // Test loss warning: effective price > FutBIN * 0.95 (20000 * 0.95 = 19000)
    state.targets[0].buyNow = 19000;
    state.targets[0].escalation.steps = 1; // effective = 19250 > 19000
    renderTargetContent(content);

    const warningCard = content.querySelector('.fr-target-card');
    const lossBadge = warningCard.querySelector('.fr-escalation-badge-loss');
    expect(lossBadge).not.toBeNull();
    expect(lossBadge.textContent).toContain('Zarar riski');

    // Changing buyNow manually resets steps to 0
    const buyNowInput = warningCard.querySelector('[aria-label="SATIN AL değeri"]');
    buyNowInput.value = '16000';
    buyNowInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(state.targets[0].buyNow).toBe(16000);
    expect(state.targets[0].escalation.steps).toBe(0);
  });
});
