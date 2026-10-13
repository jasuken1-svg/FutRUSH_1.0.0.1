import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
});
const legacy = readFileSync('legacy/futrush_v21.js', 'utf8');
const names = [...legacy.matchAll(/^  (?:async )?function (\w+)/gm)].map((m) => m[1]);
const renamed = { loadCheapestTargets: 'importCheapestTargets', parseFutbinPrice: 'parsePrice' };
const src = walk('src').map((f) => readFileSync(f, 'utf8')).join('\n');
const missing = names.filter((n) => !new RegExp('function\\s+' + (renamed[n] || n) + '\\b|\\b' + (renamed[n] || n) + '\\s*[=:(]').test(src));
console.log(names.length + ' fonksiyon kontrol edildi.');
console.log(missing.length ? 'EKSİK: ' + missing.join(', ') : 'Hepsi yeni kodda var.');