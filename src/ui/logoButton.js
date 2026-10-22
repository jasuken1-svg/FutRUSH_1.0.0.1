// Transfer Market icinde logo butonunu kaldirir.
// Bagimliliklar: core/config ve core/state.

import { CONFIG } from '../core/config.js';
import { state } from '../core/state.js';

const LG = CONFIG.logoButton;

export function initLogoButton() {
  // Transfer market logo butonu kaldirildi
}

export function placeLogoButton() {
  const logo = document.querySelector('button.' + LG.className);
  if (logo) logo.remove();
  state.logoPresent = false;
  state.panelOpen = false;
}
