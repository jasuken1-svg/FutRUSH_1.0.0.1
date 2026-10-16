# FutRUSH proje kuralları (her istekte geçerli)

Bu proje, EA FC 27 Web App için bir Tampermonkey userscript'idir. Kaynak `src/` altında ES modules olarak yazılır,
`npm run build` ile tek `dist/futrush.user.js` dosyasına derlenir. Orijinal tek dosya sürüm: `legacy/futrush_v21.js`.
Plan ve eşleme: `PLAN.md`. Aşama komutları: `docs/PROMPTS.md`.

## Değişmez kurallar
1. DAVRANIŞ DEĞİŞMEZ. Refactor sırasında mantığı yeniden yazma; fonksiyonları `legacy/futrush_v21.js` içinden BİREBİR taşı.
   Seçiciler, regex'ler, gecikmeler (speedDelay, pageDelay, tailDelay), CSS, Türkçe metinler aynı kalır.
2. Mevcut localStorage anahtarları yeniden adlandırılmaz: `fc-snipe-panel-geom`, `futrush-saved-target-filter`, `futrush-targets`, `futrush-saved-targets`. Sonraki özelliklerle eklenen `futrush-prefs` ve `futrush-snipe-settings` anahtarları da mevcut sözleşmenin parçasıdır.
3. `GM_xmlhttpRequest` ve `unsafeWindow` GLOBAL'dir, import edilmez.
4. Userscript header'ı yalnızca `src/meta.txt` içindedir; build onu bundle'ın başına ekler.
5. EA'ya ait erişim (`pageWindow.services`, `UTSearchCriteriaDTO`, `getAuctionData`, `bid`, `searchTransferMarket`)
   yalnızca `src/ea/*` içinde olur. EA DOM seçicileri `src/core/config.js` içinde toplanır.
6. Bağımlılık yönü: `ui → targets/bot → ea/futbin → utils/core`. İş mantığı modülleri UI'ı ASLA import etmez;
   iletişim `core/events.js` event bus'ı ile olur (`log:added`, `bot:status`, `targets:changed`, `panel:request-render`, `layout:request-sync`).
7. Modül sözleşmesi: `export default { name, feature, init(), sync(ctx), destroy() }`. Hata yalıtımı `core/registry.js` içinde
   try/catch ile yapılır; bir modül hata verirse diğerleri çalışmaya devam eder.
8. sync sırası değişmez: syncFromHub → placeLogoButton → applyGeom → placeSearchButton → fitContent → placeNav.
9. Hedef normalizasyonu `normalizeTarget(item, mode)` içindedir, mode: `'live' | 'savedList'`. İki modun davranışı BİLEREK farklıdır
   (filtre koşulu, rating/price yuvarlama, id yedeği); tek kurala indirme.
10. Bir dosya 400 satırı geçmez (CSS string dosyaları hariç). Sessiz `catch {}` bırakma, `logger` kullan.

## Çalışma şekli
- Kod yazmadan önce ne yapacağını 5-10 satırda özetle. Aşama dışına çıkma, ilgisiz dosyaya dokunma.
- Şüpheli bir davranış farkı görürsen BİRLEŞTİRME veya DÜZELTME yapma; raporla.
- Her aşama sonunda `npm run build` çalıştır. Hata varsa düzelt, sonra dur.
- Bitirince: değişen dosyalar, riskli noktalar ve dokunmadığın şüpheli yerler listesi ver.

## Bilinen ve BİLEREK dokunulmayacak noktalar (sadece raporla)
- Hedef `id` formatı live listede `futbin:<id>`, kayıtlı listede ham `futbinId` olabilir. Bu farklılığı tek formata indirme.
