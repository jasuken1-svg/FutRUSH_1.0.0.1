// Panel init/sync islevlerini registry modul sozlesmesine baglar.
// Bagimlilik: ui/panel/panel.

import { applyGeom, initPanel } from './panel.js';

export default {
  name: 'panel',
  init: initPanel,
  sync: applyGeom,
  initOrder: 0
};
