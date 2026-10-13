// Arama dugmesini registry init/sync ve CONFIG ozellik bayragina baglar.
// Bagimlilik: ui/searchButton.

import { initSearchButton, placeSearchButton } from './searchButton.js';

export default {
  name: 'searchButton',
  feature: 'searchButton',
  init: initSearchButton,
  sync: placeSearchButton,
  initOrder: 3
};
