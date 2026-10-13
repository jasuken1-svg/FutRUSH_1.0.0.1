// Uygulama modullerini kaydeder, olaylari baglar ve ilk init/sync dongusunu baslatir.
// Bagimliliklar: tum ozellik modulleri ile core/config, registry ve scheduler.

import { CONFIG } from './core/config.js';
import { state } from './core/state.js';
import { initAll, registry } from './core/registry.js';
import { sync, schedule } from './core/scheduler.js';
import { initDomEvents } from './core/domEvents.js';
import { createHubSyncModule } from './layout/hubSync.js';
import fitContentModule from './layout/fitContent.module.js';
import logoButtonModule from './ui/logoButton.module.js';
import panelModule from './ui/panel/panel.module.js';
import searchButtonModule from './ui/searchButton.module.js';
import navButtonModule from './ui/navButton.module.js';
import { registerPanelEvents } from './ui/panel/panelEvents.js';
import { registerModalEvents as registerSaveDialogEvents } from './ui/modals/saveDialog.js';
import { registerModalEvents as registerFilterModalEvents } from './ui/modals/filterModal.js';

registry.register(createHubSyncModule(schedule));
registry.register(logoButtonModule);
registry.register(panelModule);
registry.register(searchButtonModule);
registry.register(fitContentModule);
registry.register(navButtonModule);

registerPanelEvents();
registerSaveDialogEvents();
registerFilterModalEvents();
initAll();
initDomEvents();
sync();

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  window.__FUTRUSH__ = { state, CONFIG, registry };
}
