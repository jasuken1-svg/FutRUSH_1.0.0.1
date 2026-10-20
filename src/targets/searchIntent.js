// EA Transfer Market arama formundan kullanicinin niyetini (searchIntent) cikarir:
// { name, playerId, rarityIds, quality, buyNow }

import { idOf, toBaseId } from '../futbin/eaId.js';
import { parseFutbinPrice } from '../utils/format.js';

function getActiveMarketCriteria(pw) {
  const win = pw || (typeof unsafeWindow !== 'undefined' ? unsafeWindow : (typeof window !== 'undefined' ? window : null));
  if (!win) return null;
  if (typeof win.getAppMain === 'function') {
    try {
      const app = win.getAppMain();
      const root = typeof app?.getRootViewController === 'function' ? app.getRootViewController() : null;
      let curr = typeof root?.getPresentedViewController === 'function' ? root.getPresentedViewController() : root;
      for (let lvl = 0; lvl < 6 && curr; lvl++) {
        const sc = curr.searchCriteria
          || curr._searchCriteria
          || curr.viewmodel?.searchCriteria
          || curr._viewmodel?.searchCriteria
          || curr._viewmodel?._searchCriteria
          || null;
        if (sc) return sc;
        const children = Array.isArray(curr.childViewControllers) ? curr.childViewControllers
          : (Array.isArray(curr.viewControllers) ? curr.viewControllers
          : (Array.isArray(curr._viewControllers) ? curr._viewControllers : null));
        if (children && children.length) {
          for (const child of children) {
            const childSc = child?.searchCriteria || child?._searchCriteria || child?.viewmodel?.searchCriteria || child?._viewmodel?.searchCriteria;
            if (childSc) return childSc;
          }
        }
        curr = typeof curr.getCurrentViewController === 'function'
          ? curr.getCurrentViewController()
          : (typeof curr.getCurrentController === 'function' ? curr.getCurrentController() : null);
      }
    } catch (e) {}
  }
  return win.services?.Item?._searchCriteria || win.services?.Item?.searchCriteria || null;
}

export function extractSearchIntent({ criteria = null, doc = (typeof document !== 'undefined' ? document : null), pw = null } = {}) {
  const activeCriteria = criteria || getActiveMarketCriteria(pw);

  // Name from input
  const playerInput = doc?.querySelector('.ut-market-search-filters-view input[placeholder*="player" i], .ut-text-input-control');
  const name = String(playerInput?.value || '').trim().replace(/\s+/g, ' ');

  // Buy Now from inputs
  let buyNow = 0;
  if (doc) {
    const spinners = Array.from(doc.querySelectorAll('.ut-market-search-filters-view .search-prices .ut-numeric-input-spinner-control'));
    const maxBuyNowInput = spinners[3]?.querySelector('input');
    if (maxBuyNowInput?.value) buyNow = parseFutbinPrice(maxBuyNowInput.value);
    if (!buyNow) {
      const inputs = Array.from(doc.querySelectorAll('.ut-market-search-filters-view input'));
      const labeled = inputs.filter((inp) => {
        const parentText = inp.closest('.ut-numeric-input-spinner-control, .ut-control, .form-group, label')?.textContent || '';
        const meta = [inp.getAttribute('aria-label'), inp.placeholder, inp.name, inp.id, parentText].filter(Boolean).join(' ');
        return /buy\s*now|hemen\s*al|satın\s*al/i.test(meta) && /max|maximum|azami|en\s*yüksek/i.test(meta);
      }).pop();
      if (labeled?.value) buyNow = parseFutbinPrice(labeled.value);
    }
  }
  if (!buyNow && activeCriteria?.maxBuy) {
    buyNow = Number(activeCriteria.maxBuy) || 0;
  }

  // Dropdown text fallback from DOM
  const dropdownLabels = {};
  if (doc) {
    const form = doc.querySelector('.ut-market-search-filters-view') || doc;
    const filterEls = form.querySelectorAll('.ut-search-filter-control, .inline-list-select, .ut-drop-down-control');
    filterEls.forEach((dd, idx) => {
      const parent = dd.closest('.ut-pinned-list-item, .ut-inline-filter-view, .form-group, .ut-control') || dd.parentElement;
      const label = (parent?.querySelector('label, .label, .title')?.textContent || '').trim();
      const value = (dd.querySelector('.btn-text, .current, span')?.textContent || dd.innerText || dd.textContent || '').trim();
      if (label || value) dropdownLabels[label || ('filter_' + idx)] = value;
    });
  }

  // Player ID (base ID)
  const rawPlayerId = activeCriteria?.maskedDefId ?? activeCriteria?.defId ?? 0;
  const playerId = toBaseId(rawPlayerId) || idOf(rawPlayerId);

  // Rarity IDs
  let rarityIds = [];
  const rawRarities = activeCriteria?.rarities ?? activeCriteria?.rarityIds ?? null;
  if (Array.isArray(rawRarities)) {
    rarityIds = rawRarities.map(String);
  } else if (rawRarities != null) {
    rarityIds = [String(rawRarities)];
  } else {
    // Check DOM filter controls for TOTW
    const hasTotwText = Object.values(dropdownLabels).some((val) => /team of the week|totw/i.test(val));
    if (hasTotwText) rarityIds = ['3'];
  }

  const quality = activeCriteria?.quality ?? activeCriteria?.level ?? activeCriteria?.category ?? (
    Object.values(dropdownLabels).some((val) => /special/i.test(val)) ? 'SP' : null
  );

  return {
    name,
    playerId,
    rarityIds,
    quality,
    buyNow: Math.max(0, Math.round(buyNow)),
    dropdownLabels
  };
}
