// EA sayfa servislerinden mevcut coin bakiyesini okur.
// Bagimlilik: utils/dom icindeki sayfa penceresi adaptoru.

import { pageWindow } from '../utils/dom.js';

export function getCoinBalance() {
  return Number(pageWindow.services?.User?.getUser?.()?.coins?.amount) || 0;
}
