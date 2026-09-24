// Dev helper: serve translations/<lang>.json as /translations.json in `expo start --web`.
import { copyFileSync, mkdirSync } from 'node:fs';

const lang = process.argv[2];
if (!['he', 'en'].includes(lang)) {
  console.error('usage: node scripts/use-lang.mjs <he|en>');
  process.exit(1);
}
mkdirSync('public', { recursive: true });
copyFileSync(`translations/${lang}.json`, 'public/translations.json');
console.log(`Dev language: ${lang}`);
