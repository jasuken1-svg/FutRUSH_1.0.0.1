// Sayfa penceresinin zamanlayicisiyle gecikme Promise'i saglar.
// Bagimlilik: utils/dom.

import { pageWindow } from './dom.js';

export function wait(ms) {
  return new Promise((resolve) => pageWindow.setTimeout(resolve, ms));
}
