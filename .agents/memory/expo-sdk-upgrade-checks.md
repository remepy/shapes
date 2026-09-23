---
name: Checks that must pass after an Expo package update
description: Why `expo install --check` alone is not enough to call an Expo version bump done here
---

After any Expo version bump, run `npx expo-doctor` and require all checks to pass — do not stop at
`npx expo install --check`.

**Why:** Version alignment and dependency layout are separate problems. Bumping the SDK patch
versions here left `expo-asset` duplicated (one copy nested under `expo`) and pushed
`babel-preset-expo` out of the top level, which broke every Metro bundle with "Cannot find module
'babel-preset-expo'". `expo install --check` reported everything up to date through all of it.
Duplicated native modules are the dangerous case: web keeps working while native builds break.

**How to apply:** After the bump, run expo-doctor, then request a web bundle from the Metro dev
server and confirm a 200. Packages that must resolve from the project root (anything named in
`babel.config.js`) belong in `package.json` explicitly; npm will otherwise nest them at will. When a
patched package changes version, regenerate its file in `patches/` with `npx patch-package <name>`
and delete the old one, since patch-package keys patches by exact version.
