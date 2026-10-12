# Copilot aşama prompt'ları

Kurallar `.github/copilot-instructions.md` içinde, plan `PLAN.md` içinde. Copilot Chat'i **Agent** moduna al.
Her aşama için YENİ bir sohbet aç. Aşama sonunda: `npm run build`, Tampermonkey'de test, `git commit`.
Prompt'lara ek bağlam gerekirse `#file:` ile sadece ilgili dosyaları ekle (tüm legacy dosyasını ekleme).

## Aşama 1 (elle yapıldı)
`src/main.js` = v21 gövdesi, `src/meta.txt` = header. Sadece doğrula:
npm install -> npm run build -> dist/futrush.user.js'i Tampermonkey'e kur -> v21 ile aynı çalışıyor mu?

## Aşama 2: yaprak modüller
```
Aşama 2'yi yap. PLAN.md'deki Core (config, state, storage hariç targetStore), Utils, EA adaptörü ve FutBIN bölümlerini
src/ altına taşı. Kod legacy/futrush_v21.js içinden BİREBİR kopyalanacak (satır aralıkları PLAN.md'de).
src/main.js bu modülleri import etsin, taşınan kısımları kendi içinden silsin. Henüz UI, bot ve targets'a dokunma.
core/logger.js (seviyeli log) ve core/events.js (on/off/emit) dosyalarını da ekle, henüz kullanma.
Bitince npm run build çalıştır ve değişen dosyaları listele.
```

## Aşama 3: hedefler + bot
```
Aşama 3'ü yap: PLAN.md'deki Hedefler ve Bot bölümlerini taşı.
- normalizeTarget(item, mode) yaz, mode 'live' | 'savedList'. initPanel içindeki iki normalize kopyasının davranışı BİLEREK farklı;
  her modun filtre, yuvarlama ve id yedeği davranışını birebir koru, neden farklı olduklarını yorumla belirt.
- findDuplicateTarget tek yerde olsun (mergeTargetPlayers, restoreSavedTargets, addPinnedPlayerToTargets kullansın).
- bot/botLog.js: addBotLog ve setBotStatus artık DOM'a dokunmasın; state'i güncelleyip events.emit('log:added') / ('bot:status') yaysın.
- loadCheapestTargets ve targets/* içindeki renderTargetContent çağrılarını events.emit('targets:changed') ile değiştir.
UI tarafı (dinleyiciler) bu aşamada main.js içinde geçici olarak bu event'leri dinleyip eski render fonksiyonlarını çağırsın.
Bitince npm run build çalıştır.
```

## Aşama 4: UI
```
Aşama 4'ü yap: PLAN.md'deki UI bölümünü taşı (panel, sekmeler, modallar, nav, logo, search butonu, ikonlar).
CSS template string'lerini *.css.js dosyalarına taşı (içerik aynı). Sınıf adları, id'ler, !important'lar değişmesin.
Aşama 3'te geçici yazılan event dinleyicilerini ilgili UI modüllerine yerleştir.
UI modülleri core/registry.js'in beklediği { name, feature, init, sync, destroy } şeklini export etsin.
Bitince npm run build çalıştır.
```

## Aşama 5: layout + scheduler + registry
```
Aşama 5'i yap: layout/fitContent.js, layout/hubSync.js, core/scheduler.js, core/registry.js ve main.js'in son hali.
sync sırası aynı kalsın: syncFromHub -> placeLogoButton -> applyGeom -> placeSearchButton -> fitContent -> placeNav.
registry her modülün init/sync çağrısını try/catch ile sarsın ve hatayı logger.error('[FutRUSH:modül]', err) ile yazsın.
syncFromHub'ın ResizeObserver'ı schedule'a doğrudan bağlanmasın, callback olarak enjekte edilsin.
Logo tıklaması sync() yerine events.emit('layout:request-sync') yaysın.
main.js 60 satırı geçmesin. Bitince npm run build çalıştır.
```

## Aşama 6: test + doküman
```
Aşama 6'yı yap:
1. vitest testleri: parsePrice (K/M, binlik ayraç), normalizePlayerName, buyNowStep sınırları, parseFutbinApiPlayers,
   normalizeTarget (iki mod için ayrı; rating NaN, price 0.4, id'siz oyuncu + futbinId var/yok), findDuplicateTarget.
2. ARCHITECTURE.md: klasör haritası, modül sözleşmesi, event listesi, sync sırası, localStorage anahtarları,
   "yeni özellik nasıl eklenir", "belirti -> dosya" tablosu.
3. MIGRATION_MAP.md: legacy'deki her top-level function'ın yeni yeri. Script ile doğrula, eksik varsa listele.
4. Her dosyanın başına 1-2 satır sorumluluk yorumu.
Final raporda dokunmadığın şüpheli noktaları listele.
```

## Copilot Free'de istek tasarrufu
- Her aşama TEK istekte bitsin diye prompt'lar uzun ve kapsamlı yazıldı; araya "devam et" mesajı eklemek kota yer.
- Ajan yarıda keserse "PLAN.md'deki aşama X'in kalan maddelerine devam et, bitenleri tekrar yapma" de.
- Mekanik taşıma (satır aralığını kopyala-yapıştır) işini istersen elle yap; ajana sadece bağlama, event ve test işlerini bırak.
