import { applyGeom, initPanel } from './panel.js';

export default {
  name: 'panel',
  init: initPanel,
  sync: applyGeom,
  initOrder: 0
};
