// EA Action Panel içine RUSHbuttonv1 fiyat arama butonunu bağlar.
// Bağımlılık: ui/rushButton ve core/config.

import { installRushActionButtons, syncRushActionButtons } from './rushButton.js';
import { CONFIG } from '../core/config.js';

export function shouldEnableRushButton() {
  return CONFIG.features?.rushButton !== false;
}

export function initRushButton() {
  if (!shouldEnableRushButton()) return;
  installRushActionButtons();
}

export function syncRushButton() {
  if (!shouldEnableRushButton()) return;
  syncRushActionButtons();
}

export default {
  name: 'rushButton',
  feature: 'rushButton',
  init: initRushButton,
  sync: syncRushButton,
  initOrder: 5
};
