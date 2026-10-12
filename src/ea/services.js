import { pageWindow } from '../utils/dom.js';

export function getCoinBalance() {
  return Number(pageWindow.services?.User?.getUser?.()?.coins?.amount) || 0;
}
