import { P } from './config.js';
import { state } from './state.js';
import { pageStorage } from '../utils/dom.js';

export function loadCoreStorage() {
  try { state.geom = JSON.parse(pageStorage().getItem(P.storeKey)); } catch (e) {}
  try {
    const savedTargetFilter = JSON.parse(pageStorage().getItem('futrush-saved-target-filter'));
    if (savedTargetFilter && Array.isArray(savedTargetFilter.ratings)) {
      state.targetFilter = {
        kind: savedTargetFilter.kind === 'custom' ? 'custom' : 'cheap',
        ratings: savedTargetFilter.ratings.slice(0, 1).map(Number).filter(Number.isFinite),
        count: Math.max(1, Number(savedTargetFilter.count) || 5)
      };
    }
  } catch (e) {}
}
