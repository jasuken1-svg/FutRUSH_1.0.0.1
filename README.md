# FutRUSH

EA FC 27 Web App için Tampermonkey userscript'i. Kaynak `src/`, çıktı `dist/futrush.user.js`.

## Kurulum
```
npm install
npm run build      # dist/futrush.user.js -> Tampermonkey'e kur
```

## Geliştirme
```
npm run dev        # watch + dist/futrush.dev.user.js
```
`dist/futrush.dev.user.js` dosyasını Tampermonkey'e BİR KEZ kur (tarayıcı eklenti ayarlarında
"Allow access to file URLs" açık olmalı). Sonra kodu kaydedip EA sayfasını yenilemen yeterli.
Üretim ve dev sürümünü AYNI ANDA açık bırakma (aynı id'ler ve localStorage çakışır).

## Dosyalar
- `legacy/futrush_v21.js` orijinal tek dosya (referans, silme)
- `PLAN.md` legacy -> modül eşleme tablosu
- `docs/PROMPTS.md` Copilot aşama prompt'ları
- `.github/copilot-instructions.md` Copilot'un her istekte okuduğu proje kuralları
