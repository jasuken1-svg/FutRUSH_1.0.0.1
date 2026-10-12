import { P } from '../core/config.js';
import { state } from '../core/state.js';
import { vh } from '../utils/dom.js';

export function inTransfers() {
  const items = Array.from(document.querySelectorAll('.ut-tab-bar-item'));
  const selected = items.find((i) => /\bselected\b/.test(i.className));
  if (selected) return /transfer/i.test(selected.className + ' ' + selected.textContent);
  return state.visible;
}

export function topLimit() {
  let limit = 0;
  document.querySelectorAll('[class*="bar-view"]').forEach((el) => {
    const q = el.getBoundingClientRect();
    const isTopBar = q.width > 600 && q.height > 20 && q.height < 200 && q.top < vh() * 0.35;
    if (isTopBar) limit = Math.max(limit, q.bottom);
  });
  if (limit > 0) return limit + P.edge;
  const area = document.querySelector('.ut-navigation-container-view--content');
  return area ? area.getBoundingClientRect().top + P.edge : 0;
}
