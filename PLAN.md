# Taşıma planı: legacy/futrush_v21.js -> src/ modülleri

Satır numaraları `legacy/futrush_v21.js` içindir (src/main.js'te header çıkarıldığı için ~14 satır kayar).

## Core
| Legacy satır | İçerik | Hedef |
|---|---|---|
| 53-144 | CONFIG (+ 146-148 P/F/N kısayolları) | core/config.js |
| 153-174 | state | core/state.js |
| 399-450 | initPanel içindeki localStorage okuma (geom, filter, targets, saved lists) | core/storage.js + targets/targetStore.js |
| 804-806 | saveTargets | targets/targetStore.js |
| 2058-2083 | sync, schedule | core/scheduler.js |
| 2087-2100 | initEvents | core/domEvents.js (DOM dinleyicileri; event bus ayrı: core/events.js) |
| 2102-2109 | START | main.js |
| (yeni) | logger, events (bus), registry | core/logger.js, core/events.js, core/registry.js |

## Utils
| Legacy | İçerik | Hedef |
|---|---|---|
| 178-181 | pageWindow, pageStorage, vw, vh | utils/dom.js |
| 1916-1924 | visibleElement | utils/dom.js |
| 1221-1223 | wait | utils/async.js |
| 564-566 | normalizePlayerName | utils/strings.js |
| 1157-1166 | parseFutbinPrice (-> parsePrice, eski adla da export) | utils/format.js |
| 898-904 | buyNowStep | utils/format.js |

## EA adaptörü
| Legacy | İçerik | Hedef |
|---|---|---|
| 184-189 | inTransfers | ea/page.js |
| 1440-1450 | topLimit | ea/page.js |
| 631-652 | observeEaRequest | ea/observe.js |
| 654-664 | makeAutoBuyCriteria | ea/market.js |
| 666-693 | searchAutoBuyOffers | ea/market.js |
| 695-700 | buyAutoOffer | ea/market.js |
| 764 | coin bakiyesi okuma (`services.User.getUser().coins.amount`) | ea/services.js |

## FutBIN
| Legacy | İçerik | Hedef |
|---|---|---|
| 1049-1063 | buildFutbinUrl | futbin/urls.js |
| 1084-1096 | buildFutbinApiUrl | futbin/urls.js |
| 1065-1082 | requestFutbinPage | futbin/http.js |
| 1118-1132 | requestFutbinApi | futbin/http.js |
| 1098-1116 | parseFutbinApiPlayers | futbin/apiParser.js |
| 1169-1219 | parseFutbinPlayers | futbin/htmlParser.js |
| 568-618 | fetchFutbinPlayerId | futbin/playerLookup.js |
| 1134-1155 | loadFromFutbinApi | futbin/loader.js |
| 1225-1282 | loadCheapestTargets | futbin/loader.js |

## Hedefler (targets)
| Legacy | İçerik | Hedef |
|---|---|---|
| 620-629 | resolveTargetEaId | targets/targetOps.js |
| 808-834 | saveTargetSnapshot | targets/targetOps.js |
| 875-896 | restoreSavedTargets | targets/targetOps.js |
| 907-934 | mergeTargetPlayers | targets/targetOps.js |
| (3 yerde tekrar) | findDuplicateTarget | targets/targetOps.js |
| 1926-1946 | selectedPinnedPlayer | targets/pinnedPlayer.js |
| 1948-1966 | selectedBuyNowPrice | targets/pinnedPlayer.js |
| 1968-1998 | addPinnedPlayerToTargets | targets/pinnedPlayer.js |

## Bot
| Legacy | İçerik | Hedef |
|---|---|---|
| 544-562 | addBotLog, setBotStatus (DOM'dan ayrılacak, event yayacak) | bot/botLog.js |
| 702-728 | stopAutoBuyer, startAutoBuyer | bot/autoBuyer.js |
| 730-802 | runAutoBuyer | bot/autoBuyer.js |

## UI
| Legacy | İçerik | Hedef |
|---|---|---|
| 197-387 | panel CSS (template string) | ui/panel/panel.css.js |
| 194, 389-397 | panel oluşturma (initPanel kalanı) | ui/panel/panel.js |
| 1453-1477 | panelShown, applyGeom | ui/panel/panel.js |
| 452-471 | renderPanelTabs | ui/panel/panelTabs.js |
| 473-523 | renderPanelTabContent (Ayarlar sekmesi kısmı) | ui/panel/tabs/settingsTab.js |
| 525-542 | renderBotLogs | ui/panel/tabs/logsTab.js |
| 936-1047 | renderTargetContent | ui/panel/tabs/targetsTab.js |
| 836-873 | openTargetSaveDialog | ui/modals/saveDialog.js |
| 1284-1438 | openFilterModal (CSS ayrı dosyaya) | ui/modals/filterModal.js (+ filterModal.css.js) |
| 1634 | ICON_SVG | ui/icons.js |
| 1784 | LOGO_SVG | ui/icons.js |
| 1857-1864 | SB_BOLT_SVG | ui/icons.js |
| 1636-1717 | initSettings, openSettings, closeSettings | ui/navButton.js |
| 1719-1777 | placeNav | ui/navButton.js |
| 1781-1851 | LG, initLogoButton, findLogoAnchor, placeLogoButton | ui/logoButton.js |
| 1855-2054 (UI kısımları) | initSearchButton, layoutSearchRow, onSearchButtonClick, showTargetsAfterQuickAdd, placeSearchButton | ui/searchButton.js |

## Layout
| Legacy | İçerik | Hedef |
|---|---|---|
| 1483-1574 | resetFitted, fitContent | layout/fitContent.js |
| 1578-1630 | syncFromHub | layout/hubSync.js |

Sync modülleri kayıt sırasıyla çalışır: hubSync, logoButton, panel, searchButton,
fitContent, navButton. Registry kaydı bu sırayı korurken `initOrder`, START
sırasını (panel, settings, logo, search) korur. `layout/fitContent.js`, panel ve
`panelShown` değerlerini `ui/panel/panel.js` içinden yalnızca okur.

## Bilinen döngüsel bağımlılıklar (event bus ile çözülecek)
- addBotLog / setBotStatus -> renderBotLogs, DOM (bot -> ui)
- loadCheapestTargets, saveTargetSnapshot, addPinnedPlayerToTargets -> renderTargetContent (targets/futbin -> ui)
- showTargetsAfterQuickAdd -> renderPanelTabs (pinnedPlayer -> ui)
- logo click -> sync() (ui -> scheduler)
- renderPanelTabContent -> startAutoBuyer / stopAutoBuyer (ui -> bot; yön doğru, event gerekmez)
- syncFromHub -> schedule (layout -> scheduler; ResizeObserver callback'i olarak enjekte edilir)
- fitContent -> panel, panelShown (layout -> ui/panel; yalnızca okuma)
