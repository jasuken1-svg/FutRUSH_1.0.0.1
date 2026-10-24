// RUSHbuttonv1 kart butonunu registry init/sync ve CONFIG ozellik bayragina baglar.
// Bagimlilik: ui/rushButton.

import { initRushButton, syncRushButton } from './rushButton.js';

export default {
  name: 'rushButton',
  feature: 'rushButton',
  init: initRushButton,
  sync: syncRushButton,
  initOrder: 4
};
