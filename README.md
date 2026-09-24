# Shapes

A spatial puzzle for the daily protocol: find the square on the board that contains the
shape shown at the bottom. Built with Expo / React Native for Web and shipped as a static
site that the app opens in a full-window WebView. It speaks the app bridge, protocol v1
(`Cyan Game Bridge — v1`, revision B).

## Bridge binding

| | |
|---|---|
| `gameId` | `shapes` |
| URL | `https://<cdn>/games/shapes/{lang}/index.html` (`{lang}` = `he` or `en`) |
| Level catalogue | 252 fixed levels, `shapes-001` … `shapes-252` |
| Rounds per session | 6 (whatever the app sends in `levelIds`; 6 when run standalone) |
| `stats` keys | `wrongTaps` (int), `hintsUsed` (int, 0–2 per round), `rotations` (int) |
| `outcome` | Always `won`: a round only ends when the right square is found |

`level_completed.stats` holds the counts for that round. `game_finished.stats` holds the
totals for the session, with the same keys.

Every level ID always produces the same board and the same starting rotation of the goal
shape. The app owns the level pointer (BR-03): the game never stores progress.

## How the game behaves

| Situation | Game does |
|---|---|
| Page loads | Fetches `./translations.json`, then posts `game_ready { gameId, protocolVersion: 1, locale }`. The screen stays empty until `session_start`. |
| `session_start` | Checks `protocolVersion`, `expectedLocale` against its own locale (BR-14), and every level ID. Shows the tutorial only when `tutorialSeen` is `false`. |
| Round solved, not the last | Posts `level_completed`, shows the success screen with **Next level** and **Exit activity**. |
| Last round solved | Posts `level_completed`, shows the success screen with no buttons, then posts `game_finished` 1.5 s later. |
| `pause` / `resume` | Music stops and all buttons are disabled / everything comes back. |
| `abort` | Stops music and input, clears the screen, posts nothing further. |
| X in the header, or **Exit activity** | Posts `game_exit_requested` and clears the screen. |
| No bridge on the page | Runs standalone (BR-09): 6 rounds from `shapes-001`, tutorial flag kept in local storage, **Play again** after round 6. Posts nothing. |

`game_error` codes: `translations_unavailable`, `locale_mismatch`, `session_start_timeout`
(no `session_start` within 5 s, BR-11), `protocol_mismatch`, `invalid_session`,
`unknown_level`, `render_error`. After any error the screen is empty. The error message is
never shown (BR-10).

After `game_finished`, `game_exit_requested`, `game_error` or `abort`, the game posts nothing
more.

## Copy and languages

All text lives in `translations/he.json` and `translations/en.json`, in the self-describing
format from spec §4.2 (`locale`, `dir`, `keys`). The game refuses to start if the file is
missing, unparseable or missing any key, so a raw key never reaches the screen. Text
direction comes from `dir` (BR-15).

Hebrew copy is gender-neutral (BR-08), using plural forms such as "לחצו".

To correct copy after deployment, replace `translations.json` in that language's folder on
S3. No rebuild is needed.

## Development

Requires Node 20+.

```bash
npm install
npm run dev:he        # or dev:en: live-reloading dev server at http://localhost:8081
```

## Build and local QA

```bash
npm run build         # → dist/games/shapes/he/ and dist/games/shapes/en/
npm run serve         # S3-like local server with the production cache headers
```

Then open:

- Hebrew: http://localhost:3000/games/shapes/he/index.html
- English: http://localhost:3000/games/shapes/en/index.html

With no app around, the game runs standalone. To simulate the app, add `?bridge=1`:

- http://localhost:3000/games/shapes/he/index.html?bridge=1

The local server (not the game) then injects a stand-in for the app's `CyanGameBridge`. It
answers `game_ready` with a 6-round `session_start` and logs every message in both
directions to the browser console. In the console, `qa.pause()`, `qa.resume()` and
`qa.abort()` send those messages, and `qa.messages` lists what the game has posted.

Options you can add to the address: `&tutorial=0` (as though the tutorial was already
seen), `&levels=shapes-100,shapes-101`, `&reducedMotion=1`, `&locale=en-US` (to try a
locale mismatch).

## Deploying to S3

Each language is its own build, compiled with the base path `/games/shapes/<lang>`. If the
bucket uses a different prefix, set `CDN_PREFIX` when building (default `/games`), for
example `CDN_PREFIX=/v2/games npm run build`.

Upload `dist/games/shapes/` to the same key prefix and set cache headers as in spec §4.4:

| Files | `Cache-Control` |
|---|---|
| `index.html`, `translations.json` | `no-cache` |
| everything else (`_expo/**`, `assets/**`, `favicon.ico`) | `public, max-age=31536000, immutable` |

Everything loads from the page's own origin and prefix: no external fonts, scripts or
requests.

## Project layout

```
App.tsx                  lifecycle: translations → game_ready → session_start → game
components/GameScreen.tsx  the game screen, rounds and stats
components/GameBoard.tsx   SVG board and goal tile
components/TutorialOverlay.tsx
hooks/useTutorial.ts     tutorial steps and the tutorial-seen flag
lib/bridge.ts            the bridge (both directions)
lib/levels.ts            level catalogue: id → seed
lib/game-engine.ts       board generator
lib/i18n.tsx             loading and validating translations.json
translations/            he.json, en.json
scripts/                 build, local server, dev language switch
```
