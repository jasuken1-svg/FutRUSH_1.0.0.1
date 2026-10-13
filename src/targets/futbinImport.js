// FutBIN oyuncularini yukler, hedef listesine birlestirir ve UI durumunu yayinlar.
// Bagimliliklar: core/state/events, futbin/loader ve targets/targetOps.

import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { mergeTargetPlayers } from './targetOps.js';
import { fetchCheapestPlayers } from '../futbin/loader.js';

export async function importCheapestTargets(rating, count) {
  if (state.targetLoading) return;
  state.targetLoading = true;
  state.targetStatus = null;
  emit('targets:changed');
  try {
    const result = await fetchCheapestPlayers(rating, count);
    const added = mergeTargetPlayers(result.players);
    const fallbackNote = result.source === 'api' ? ' (FutBIN yedek kaynağı)' : '';
    state.targetStatus = {
      type: 'success',
      message: added ? added + ' oyuncu hedef listesine eklendi' + fallbackNote + '.' : 'Bulunan oyuncular zaten hedef listesinde.'
    };
  } catch (error) {
    state.targetStatus = { type: 'error', message: error.message || 'FutBIN oyuncuları yüklenemedi.' };
    if (error.blocked) console.error('[FutRUSH] FutBIN engelleme ayrıntısı:', error);
  } finally {
    state.targetLoading = false;
    emit('targets:changed');
  }
}
