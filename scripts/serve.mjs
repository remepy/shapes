// Local static server that behaves like S3/CloudFront for QA: no redirects or
// "clean URLs", and the same cache headers as production (bridge spec §4.4).
//   npm run build && npm run serve
//   → http://localhost:3000/games/shapes/he/index.html
//
// Add ?bridge=1 to the page URL and this server (not the game) injects a
// stand-in for the app's CyanGameBridge channel. It logs every message in the
// browser console and answers game_ready with a session_start. In the console:
//   qa.pause() · qa.resume() · qa.abort() · qa.messages
// Optional overrides: ?bridge=1&tutorial=0&levels=shapes-007,shapes-008&locale=en-US
const QA_BRIDGE = (q) => `<script>
(() => {
  const q = new URLSearchParams(${JSON.stringify(q)});
  const locale = q.get('locale') || document.documentElement.lang;
  const levelIds = (q.get('levels') || 'shapes-001,shapes-002,shapes-003,shapes-004,shapes-005,shapes-006').split(',');
  const send = (m) => { console.log('%capp → game', 'color:#0a84ff', m); window.cyanBridge.receive(m); };
  window.qa = { messages: [],
    pause: () => send({ type: 'pause' }), resume: () => send({ type: 'resume' }),
    abort: () => send({ type: 'abort', data: { reason: 'qa' } }) };
  // In the real app these messages end the activity and the app shows its own
  // screen. Locally nothing would happen, so show what the app received.
  const showHandover = (m) => {
    const titles = { game_finished: 'Session complete: the app now shows its summary',
      game_exit_requested: 'Player quit: the app ends the activity (not completed)',
      game_error: 'Game error: the app ends the activity (not completed)' };
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;padding:14px 16px;' +
      'border-radius:14px;background:#1c1c1e;color:#fff;font:14px/1.4 -apple-system,system-ui,sans-serif;' +
      'border:1px solid #0a84ff;box-shadow:0 6px 24px rgba(0,0,0,.6);direction:ltr;text-align:left';
    box.innerHTML = '<div style="font-weight:600;color:#0a84ff;margin-bottom:6px">QA · ' + titles[m.type] + '</div>' +
      '<pre style="margin:0 0 10px;white-space:pre-wrap;font:12px ui-monospace,monospace;color:#ccc"></pre>' +
      '<button style="font:600 15px system-ui;padding:10px 16px;border:0;border-radius:10px;background:#0a84ff;color:#fff">Play again</button>';
    box.querySelector('pre').textContent = JSON.stringify(m.data ?? {}, null, 1);
    box.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(box);
  };
  window.CyanGameBridge = { postMessage: (raw) => {
    const m = JSON.parse(raw); qa.messages.push(m);
    console.log('%cgame → app', 'color:#30d158', m);
    if (['game_finished', 'game_exit_requested', 'game_error'].includes(m.type)) setTimeout(() => showHandover(m), 400);
    if (m.type === 'game_ready') setTimeout(() => send({ type: 'session_start', data: {
      protocolVersion: 1, sessionId: 'qa-' + Date.now(), expectedLocale: locale, levelIds,
      reducedMotion: q.get('reducedMotion') === '1', tutorialSeen: q.get('tutorial') === '0' } }), 300);
  } };
})();
</script>`;
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = 'dist';
const PORT = Number(process.env.PORT ?? 3000);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.map': 'application/json',
};

createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    let body = await readFile(file);
    const name = file.split('/').pop();
    const query = new URL(req.url, 'http://x').search;
    if (name === 'index.html' && new URLSearchParams(query).get('bridge') === '1') {
      body = body.toString().replace('<head>', '<head>' + QA_BRIDGE(query));
    }
    const cache = name === 'index.html' || name === 'translations.json'
      ? 'no-cache' : 'public, max-age=31536000, immutable';
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': cache });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => {
  console.log(`Serving ${ROOT}/ on http://localhost:${PORT}`);
  console.log(`  Hebrew:  http://localhost:${PORT}/games/shapes/he/index.html`);
  console.log(`  English: http://localhost:${PORT}/games/shapes/en/index.html`);
  console.log(`  Add ?bridge=1 to simulate the app (messages appear in the browser console).`);
});
