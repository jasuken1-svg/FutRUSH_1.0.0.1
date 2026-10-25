// EA detay paneli (.ut-button-group) fiyat kontrolu modülünü registry'ye baglar.
// Bagimlilik: ui/ea/detailLowestPrices.

import { initDetailLowestPrices, destroyDetailLowestPrices } from './detailLowestPrices.js';

export default {
  name: 'detailLowestPrices',
  feature: 'detailLowestPrices',
  init: initDetailLowestPrices,
  destroy: destroyDetailLowestPrices,
  initOrder: 5
};
