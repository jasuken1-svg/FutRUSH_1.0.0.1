# Legacy -> kaynak modul esleme haritasi

`npm run migration-map` ile `legacy/futrush_v21.js` icindeki top-level fonksiyon bildirimlerinden uretilir. Yalnizca `src/` altinda tanimli fonksiyonlar eslesme sayilir.

- Legacy top-level fonksiyon sayisi: **60**
- Eslesen: **60**
- Eksik/eslesmeyen: **0**

| Legacy fonksiyonu | Yeni tanim(lar) | Durum |
|---|---|---|
| `inTransfers` | `inTransfers` — `src/ea/page.js` | Eslesti |
| `initPanel` | `initPanel` — `src/ui/panel/panel.js` | Eslesti |
| `renderPanelTabs` | `renderPanelTabs` — `src/ui/panel/panelTabs.js` | Eslesti |
| `renderPanelTabContent` | `renderPanelTabContent` — `src/ui/panel/panelTabs.js` | Eslesti |
| `renderBotLogs` | `renderBotLogs` — `src/ui/panel/tabs/logsTab.js` | Eslesti |
| `addBotLog` | `addBotLog` — `src/bot/botLog.js` | Eslesti |
| `setBotStatus` | `setBotStatus` — `src/bot/botLog.js` | Eslesti |
| `normalizePlayerName` | `normalizePlayerName` — `src/utils/strings.js` | Eslesti |
| `fetchFutbinPlayerId` | `fetchFutbinPlayerId` — `src/futbin/playerLookup.js` | Eslesti |
| `resolveTargetEaId` | `resolveTargetEaId` — `src/targets/targetOps.js` | Eslesti |
| `observeEaRequest` | `observeEaRequest` — `src/ea/observe.js` | Eslesti |
| `makeAutoBuyCriteria` | `makeAutoBuyCriteria` — `src/ea/market.js` | Eslesti |
| `searchAutoBuyOffers` | `searchAutoBuyOffers` — `src/ea/market.js` | Eslesti |
| `buyAutoOffer` | `buyAutoOffer` — `src/ea/market.js` | Eslesti |
| `stopAutoBuyer` | `stopAutoBuyer` — `src/bot/autoBuyer.js` | Eslesti |
| `startAutoBuyer` | `startAutoBuyer` — `src/bot/autoBuyer.js` | Eslesti |
| `runAutoBuyer` | `runAutoBuyer` — `src/bot/autoBuyer.js` | Eslesti |
| `saveTargets` | `saveTargets` — `src/targets/targetStore.js` | Eslesti |
| `saveTargetSnapshot` | `saveTargetSnapshot` — `src/targets/targetOps.js` | Eslesti |
| `openTargetSaveDialog` | `openTargetSaveDialog` — `src/ui/modals/saveDialog.js` | Eslesti |
| `restoreSavedTargets` | `restoreSavedTargets` — `src/targets/targetOps.js` | Eslesti |
| `buyNowStep` | `buyNowStep` — `src/utils/format.js` | Eslesti |
| `mergeTargetPlayers` | `mergeTargetPlayers` — `src/targets/targetOps.js` | Eslesti |
| `renderTargetContent` | `renderTargetContent` — `src/ui/panel/tabs/targetsTab.js` | Eslesti |
| `buildFutbinUrl` | `buildFutbinUrl` — `src/futbin/urls.js` | Eslesti |
| `requestFutbinPage` | `requestFutbinPage` — `src/futbin/http.js` | Eslesti |
| `buildFutbinApiUrl` | `buildFutbinApiUrl` — `src/futbin/urls.js` | Eslesti |
| `parseFutbinApiPlayers` | `parseFutbinApiPlayers` — `src/futbin/apiParser.js` | Eslesti |
| `requestFutbinApi` | `requestFutbinApi` — `src/futbin/http.js` | Eslesti |
| `loadFromFutbinApi` | `loadFromFutbinApi` — `src/futbin/loader.js` | Eslesti |
| `parseFutbinPrice` | `parsePrice` — `src/utils/format.js` | Eslesti |
| `parseFutbinPlayers` | `parseFutbinPlayers` — `src/futbin/htmlParser.js` | Eslesti |
| `wait` | `wait` — `src/utils/async.js` | Eslesti |
| `loadCheapestTargets` | `importCheapestTargets` — `src/targets/futbinImport.js`<br>`fetchCheapestPlayers` — `src/futbin/loader.js` | Eslesti |
| `openFilterModal` | `openFilterModal` — `src/ui/modals/filterModal.js` | Eslesti |
| `topLimit` | `topLimit` — `src/ea/page.js` | Eslesti |
| `panelShown` | `panelShown` — `src/ui/panel/panel.js` | Eslesti |
| `applyGeom` | `applyGeom` — `src/ui/panel/panel.js` | Eslesti |
| `resetFitted` | `resetFitted` — `src/layout/fitContent.js` | Eslesti |
| `fitContent` | `fitContent` — `src/layout/fitContent.js` | Eslesti |
| `syncFromHub` | `syncFromHub` — `src/layout/hubSync.js` | Eslesti |
| `initSettings` | `initSettings` — `src/ui/navButton.js` | Eslesti |
| `openSettings` | `openSettings` — `src/ui/navButton.js` | Eslesti |
| `closeSettings` | `closeSettings` — `src/ui/navButton.js` | Eslesti |
| `placeNav` | `placeNav` — `src/ui/navButton.js` | Eslesti |
| `initLogoButton` | `initLogoButton` — `src/ui/logoButton.js` | Eslesti |
| `findLogoAnchor` | `findLogoAnchor` — `src/ui/logoButton.js` | Eslesti |
| `placeLogoButton` | `placeLogoButton` — `src/ui/logoButton.js` | Eslesti |
| `initSearchButton` | `initSearchButton` — `src/ui/searchButton.js` | Eslesti |
| `layoutSearchRow` | `layoutSearchRow` — `src/ui/searchButton.js` | Eslesti |
| `onSearchButtonClick` | `onSearchButtonClick` — `src/ui/searchButton.js` | Eslesti |
| `showTargetsAfterQuickAdd` | `showTargetsAfterQuickAdd` — `src/ui/searchButton.js` | Eslesti |
| `visibleElement` | `visibleElement` — `src/utils/dom.js` | Eslesti |
| `selectedPinnedPlayer` | `selectedPinnedPlayer` — `src/targets/pinnedPlayer.js` | Eslesti |
| `selectedBuyNowPrice` | `selectedBuyNowPrice` — `src/targets/pinnedPlayer.js` | Eslesti |
| `addPinnedPlayerToTargets` | `addPinnedPlayerToTargets` — `src/targets/pinnedPlayer.js` | Eslesti |
| `placeSearchButton` | `placeSearchButton` — `src/ui/searchButton.js` | Eslesti |
| `sync` | `sync` — `src/core/scheduler.js` | Eslesti |
| `schedule` | `schedule` — `src/core/scheduler.js` | Eslesti |
| `initEvents` | `initEvents` — `src/core/domEvents.js` | Eslesti |

## Eksik fonksiyonlar

Eksik fonksiyon yok.
