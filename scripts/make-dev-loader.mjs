// Tampermonkey'e BİR KEZ kurulan küçük yükleyici: derlenmiş dosyayı diskten @require ile okur.
// Sonrasında kodu kaydedince sadece EA sayfasını yenilemen yeterli.
// Gerekli: tarayıcı eklenti ayarlarında Tampermonkey için "Allow access to file URLs" açık olmalı.
import { writeFileSync } from 'node:fs';

export function writeDevLoader(meta, bundleFileUrl) {
  const header = meta
    .replace('// @name         FutRUSH', '// @name         FutRUSH (DEV)')
    .replace('// ==/UserScript==', '// @require      ' + bundleFileUrl + '\n// ==/UserScript==');
  writeFileSync('dist/futrush.dev.user.js', header + '// Kod @require ile yüklenir; bu dosyada kod yok.\n');
}
