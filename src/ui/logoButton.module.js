// Logo dugmesini registry init/sync ve CONFIG ozellik bayragina baglar.
// Bagimlilik: ui/logoButton.

import { initLogoButton, placeLogoButton } from './logoButton.js';

export default {
  name: 'logoButton',
  feature: 'logoButton',
  init: initLogoButton,
  sync: placeLogoButton,
  initOrder: 2
};
