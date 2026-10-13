import { initSettings, placeNav } from './navButton.js';

export default {
  name: 'navButton',
  feature: 'settingsButton',
  init: initSettings,
  sync: placeNav,
  initOrder: 1
};
