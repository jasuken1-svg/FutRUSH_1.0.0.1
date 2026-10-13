import { fitContent } from './fitContent.js';

export default {
  name: 'fitContent',
  feature: 'fitContent',
  sync: ({ onHub }) => fitContent(onHub)
};
