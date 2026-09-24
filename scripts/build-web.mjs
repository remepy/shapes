// Builds one static site per language, laid out exactly as on S3 (bridge spec §4.1):
//   dist/games/shapes/he/{index.html, translations.json, _expo/…, assets/…}
//   dist/games/shapes/en/…
// Override the prefix with CDN_PREFIX (default /games) if the bucket layout differs.
import { execFileSync } from 'node:child_process';
import { copyFileSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GAME_ID = 'shapes';
const LANGS = ['he', 'en'];
const prefix = (process.env.CDN_PREFIX ?? '/games').replace(/\/$/, '');

rmSync('dist', { recursive: true, force: true });
rmSync(join('public', 'translations.json'), { force: true }); // dev-only copy

for (const lang of LANGS) {
  const basePath = `${prefix}/${GAME_ID}/${lang}`;
  const outDir = join('dist', basePath);
  console.log(`\n▶ Building ${lang} → ${outDir} (base path ${basePath})`);
  execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', outDir, '--clear'], {
    stdio: 'inherit',
    env: { ...process.env, GAME_BASE_PATH: basePath },
  });
  copyFileSync(join('translations', `${lang}.json`), join(outDir, 'translations.json'));
  const indexPath = join(outDir, 'index.html');
  if (!existsSync(indexPath)) throw new Error(`no index.html in ${outDir}`);
  // First paint already in the right language (the game re-applies it from
  // translations.json at runtime, which stays authoritative).
  const tr = JSON.parse(readFileSync(join('translations', `${lang}.json`), 'utf8'));
  const html = readFileSync(indexPath, 'utf8')
    .replace(/<html lang="[^"]*">/, `<html lang="${tr.locale}">`)
    .replace(/<title>[^<]*<\/title>/, '<title></title>')
    .replace('width=device-width, initial-scale=1, shrink-to-fit=no', 'width=device-width, initial-scale=1, viewport-fit=cover');
  writeFileSync(indexPath, html);
}
console.log(`\n✔ Built ${LANGS.length} language builds under dist${prefix}/${GAME_ID}/`);
