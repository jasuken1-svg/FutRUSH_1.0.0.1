// Ayarlar dugmesini registry init/sync ve CONFIG ozellik bayragina baglar.
// Bagimlilik: ui/navButton.

import { initSettings, placeNav } from './navButton.js';

export default {
  name: 'navButton',
  feature: 'settingsButton',
  init: initSettings,
  sync: placeNav,
  initOrder: 1
};
