// src/ altındaki modülleri tek bir Tampermonkey dosyasına derler.
//   npm run build  -> dist/futrush.user.js          (kurulacak üretim dosyası)
//   npm run dev    -> watch + inline sourcemap + dist/futrush.dev.user.js (@require yükleyici)
import { build, context } from 'esbuild';
import { readFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeDevLoader } from './scripts/make-dev-loader.mjs';

const dev = process.argv.includes('--dev');
const watch = process.argv.includes('--watch');

// Userscript header dosyanın EN BAŞINDA olmalı (banner olarak eklenir)
const meta = readFileSync('src/meta.txt', 'utf8').replace(/\r\n/g, '\n').trimEnd() + '\n\n';

const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'dist/futrush.user.js',
  banner: { js: meta },
  sourcemap: dev ? 'inline' : false,   // hata satırları modül dosyasını göstersin
  legalComments: 'none',
  logLevel: 'info',
  define: { __DEV__: JSON.stringify(dev) }
};

mkdirSync('dist', { recursive: true });

if (dev) {
  const bundlePath = resolve('dist/futrush.user.js');
  writeDevLoader(meta, pathToFileURL(bundlePath).href);
}

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[futrush] watch modu açık. Kaydettikçe dist/futrush.user.js yenilenir.');
} else {
  await build(options);
}
