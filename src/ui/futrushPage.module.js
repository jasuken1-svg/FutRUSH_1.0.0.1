// FutRUSH sekmesi ve sayfasini registry modul sozlesmesine baglar.
// Bagimlilik: ui/futrushPage.

import { initFutrushPage, placeFutrushTab } from './futrushPage.js';

export default {
  name: 'futrushPage',
  init: initFutrushPage,
  sync: placeFutrushTab,
  initOrder: 1
};
