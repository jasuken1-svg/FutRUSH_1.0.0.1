// EA hub durumunu olcer ve kayitli modulleri sirayla senkronize eder.
// Bagimliliklar: core/config, core/events ve core/registry.

import { CONFIG } from './config.js';
import { on } from './events.js';
import { syncAll } from './registry.js';

export function sync() {
  const marketTile = document.querySelector('.ut-tile-transfer-market');
  const onHub = !!(marketTile && marketTile.getBoundingClientRect().width > 0);
  syncAll({ onHub, marketTile });
}

let queued = false;
let tail = null;

export function schedule() {
  clearTimeout(tail);
  tail = setTimeout(sync, CONFIG.timing.tailDelay);
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; sync(); });
}

on('layout:request-sync', sync);
