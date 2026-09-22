#!/bin/bash
# Runs automatically after a task merge: sync dependencies and rebuild the
# static web bundle that the Express server serves from dist/.
set -e

npm install --no-audit --no-fund
./node_modules/.bin/expo export --platform web
