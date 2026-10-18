import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { extractSearchIntent } from '../../src/targets/searchIntent.js';

describe('extractSearchIntent', () => {
  it('extracts intent from criteria when available', () => {
    const dom = new JSDOM(`
      <div class="ut-market-search-filters-view">
        <input class="ut-text-input-control" value="Esmee Brugts">
      </div>
    `);
    const criteria = {
      maskedDefId: 267530,
      rarityIds: [3],
      quality: 'special',
      maxBuy: 85000
    };

    const intent = extractSearchIntent({ criteria, doc: dom.window.document });

    expect(intent).toEqual({
      name: 'Esmee Brugts',
      playerId: 267530,
      rarityIds: ['3'],
      quality: 'special',
      buyNow: 85000,
      dropdownLabels: {}
    });
  });

  it('falls back to DOM dropdowns when criteria has no rarityIds', () => {
    const dom = new JSDOM(`
      <div class="ut-market-search-filters-view">
        <input class="ut-text-input-control" value="Brugts">
        <div class="ut-control">
          <label class="label">Rarity</label>
          <div class="ut-drop-down-control"><span class="btn-text">Team of the Week</span></div>
        </div>
        <div class="search-prices">
          <div class="ut-numeric-input-spinner-control"><input value="150"></div>
          <div class="ut-numeric-input-spinner-control"><input value="200"></div>
          <div class="ut-numeric-input-spinner-control"><input value="10000"></div>
          <div class="ut-numeric-input-spinner-control"><input value="85,000"></div>
        </div>
      </div>
    `);

    const intent = extractSearchIntent({ criteria: { maskedDefId: 267530 }, doc: dom.window.document });

    expect(intent.name).toBe('Brugts');
    expect(intent.playerId).toBe(267530);
    expect(intent.rarityIds).toEqual(['3']);
    expect(intent.buyNow).toBe(85000);
    expect(intent.dropdownLabels).toHaveProperty('Rarity', 'Team of the Week');
  });

  it('handles empty DOM and missing criteria gracefully', () => {
    const dom = new JSDOM(`<div></div>`);
    const intent = extractSearchIntent({ criteria: null, doc: dom.window.document, pw: {} });

    expect(intent.name).toBe('');
    expect(intent.playerId).toBe(0);
    expect(intent.rarityIds).toEqual([]);
    expect(intent.buyNow).toBe(0);
  });
});
