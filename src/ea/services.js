// EA sayfa servislerinden mevcut coin bakiyesini okur.
// Bagimlilik: ea/balance

import { getBalance } from './balance.js';
import { getTransferListCount, getTransferListCapacity, isTransferListFull, getUnassignedCount, getWatchlistCount } from './piles.js';

export {
  getBalance,
  getBalance as getCoinBalance,
  getTransferListCount,
  getTransferListCapacity,
  isTransferListFull,
  getUnassignedCount,
  getWatchlistCount
};
