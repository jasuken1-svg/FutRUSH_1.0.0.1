import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const legacyPath = join(root, 'legacy', 'futrush_v21.js');
const sourceRoot = join(root, 'src');
const outputPath = join(root, 'MIGRATION_MAP.md');
const renames = new Map([
  ['loadCheapestTargets', ['importCheapestTargets', 'fetchCheapestPlayers']],
  ['parseFutbinPrice', ['parsePrice']]
]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.isFile() && path.endsWith('.js') ? [path] : [];
  }).sort();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasDeclaration(source, name) {
  const escaped = escapeRegExp(name);
  const functionDeclaration = new RegExp(`\\bfunction\\s+${escaped}\\s*\\(`);
  const arrowDeclaration = new RegExp(
    `\\b(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[\\w$]+)\\s*=>`
  );
  return functionDeclaration.test(source) || arrowDeclaration.test(source);
}

const legacy = readFileSync(legacyPath, 'utf8');
const names = [...legacy.matchAll(/^  (?:async )?function ([A-Za-z_$][\w$]*)\s*\(/gm)]
  .map((match) => match[1]);
const files = walk(sourceRoot).map((path) => ({
  path: relative(root, path).split(sep).join('/'),
  source: readFileSync(path, 'utf8')
}));

const rows = names.map((legacyName) => {
  const candidates = renames.get(legacyName) || [legacyName];
  const matches = candidates.flatMap((name) => files
    .filter((file) => hasDeclaration(file.source, name))
    .map((file) => ({ name, path: file.path })));
  const expectedCount = candidates.length;
  const complete = matches.length === expectedCount;
  return { legacyName, candidates, matches, complete };
});

const missing = rows.filter((row) => !row.complete);
const tableRows = rows.map(({ legacyName, matches, complete }) => {
  const destinations = matches.length
    ? matches.map(({ name, path }) => `\`${name}\` — \`${path}\``).join('<br>')
    : '—';
  return `| \`${legacyName}\` | ${destinations} | ${complete ? 'Eslesti' : 'EKSIK'} |`;
});

const report = [
  '# Legacy -> kaynak modul esleme haritasi',
  '',
  '`npm run migration-map` ile `legacy/futrush_v21.js` icindeki top-level fonksiyon bildirimlerinden uretilir. Yalnizca `src/` altinda tanimli fonksiyonlar eslesme sayilir.',
  '',
  `- Legacy top-level fonksiyon sayisi: **${names.length}**`,
  `- Eslesen: **${rows.length - missing.length}**`,
  `- Eksik/eslesmeyen: **${missing.length}**`,
  '',
  '| Legacy fonksiyonu | Yeni tanim(lar) | Durum |',
  '|---|---|---|',
  ...tableRows,
  '',
  '## Eksik fonksiyonlar',
  '',
  ...(missing.length ? missing.map((row) => `- \`${row.legacyName}\` (beklenen: ${row.candidates.join(', ')})`) : ['Eksik fonksiyon yok.']),
  ''
].join('\n');

writeFileSync(outputPath, report, 'utf8');
console.log(`MIGRATION_MAP.md olusturuldu. ${names.length} fonksiyon incelendi.`);
if (missing.length) {
  console.error(`Eksik/eslesmeyen fonksiyonlar: ${missing.map((row) => row.legacyName).join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Eksik fonksiyon yok.');
}
