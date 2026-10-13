// Icerik sigdirma davranisini registry sync sozlesmesine baglar.
// Bagimlilik: layout/fitContent.

import { fitContent } from './fitContent.js';

export default {
  name: 'fitContent',
  feature: 'fitContent',
  sync: ({ onHub }) => fitContent(onHub)
};
