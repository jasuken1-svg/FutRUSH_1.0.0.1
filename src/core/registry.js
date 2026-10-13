// Ozellik modullerini kaydeder, init/sync/destroy dongulerini ve hata sinirini yonetir.
// Bagimliliklar: core/config ve core/logger.

import { CONFIG } from './config.js';
import * as logger from './logger.js';

const modules = [];

export function register({ name, feature, init, sync, destroy, initOrder }) {
  modules.push({ name, feature, init, sync, destroy, initOrder });
}

function isEnabled(module) {
  return !module.feature || CONFIG.features[module.feature] !== false;
}

function run(module, method, context) {
  if (!isEnabled(module) || typeof module[method] !== 'function') return;
  try {
    module[method](context);
  } catch (err) {
    logger.error('[FutRUSH:' + module.name + ']', err);
  }
}

export function initAll() {
  [...modules]
    .sort((a, b) => (a.initOrder ?? Infinity) - (b.initOrder ?? Infinity))
    .forEach((module) => run(module, 'init'));
}

export function syncAll(ctx) {
  modules.forEach((module) => run(module, 'sync', ctx));
}

export function destroyAll() {
  modules.forEach((module) => run(module, 'destroy'));
}

export const registry = { register, initAll, syncAll, destroyAll };
