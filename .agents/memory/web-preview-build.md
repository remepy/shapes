---
name: Web preview build pipeline
description: How the Replit preview serves this Expo app, and what must be true for code changes to show up.
---

# Web preview serves a prebuilt export, not Metro

The workspace preview is the Express server, which serves a static Expo web export from `dist/`.
Metro (the Expo dev server) runs too, but the preview does **not** use it — editing a component and
relying on fast refresh will NOT change what the preview shows.

**How to apply:** after changing app code, re-run the web export before screenshotting or judging the preview.
The export must be run with `EXPO_PUBLIC_DOMAIN` set (same value the dev script uses), because the query
client throws at startup when that variable is missing, which produces a blank white page with no console error.

**Why (blank-page traps seen in practice):**
- The root layout returns `null` until the Rubik fonts resolve, so *any* font 404 renders an all-white app with no error output. A white screen here almost always means an asset request is failing, not a React crash.
- Exported asset URLs contain pnpm's `.pnpm/` directory. `express.static` ignores dot-segment paths by default, so those requests fell through to the SPA fallback and returned HTML for .ttf files. Allow dotfiles only on the generated build roots — never on `node_modules` or the source tree, which would publish dependency metadata.
- A workflow restart can leave an old server process bound alongside the new one, making responses alternate between correct and stale. If behavior is intermittent, check for duplicate server processes before debugging the code.
