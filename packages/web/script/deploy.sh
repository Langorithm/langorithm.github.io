#!/usr/bin/env bash
# Build the web app as a static site that syncs through flok.cc and publish
# it to GitHub Pages, replacing the target repo's contents in a new commit.
#
# Usage: npm run deploy
# Env:   FLOK_SERVER  sync server (default https://flok.cc)
#        DEPLOY_REPO  GitHub repo served by Pages (default Langorithm/langorithm.github.io)
#        DEPLOY_BRANCH branch Pages serves from (default main)
set -euo pipefail

FLOK_SERVER="${FLOK_SERVER:-https://flok.cc}"
DEPLOY_REPO="${DEPLOY_REPO:-Langorithm/langorithm.github.io}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

cd "$(dirname "$0")/.."

VITE_FLOK_SERVER="$FLOK_SERVER" npm run build

# GitHub Pages has no rewrites: serve the app for every route (/s/<name>,
# /frames/<target>) via the 404 page, and skip Jekyll processing.
cp dist/index.html dist/404.html
touch dist/.nojekyll

rev="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- . ../lang-* || echo -dirty)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone --quiet --depth 1 --branch "$DEPLOY_BRANCH" \
  "git@github.com:$DEPLOY_REPO.git" "$tmp"
git -C "$tmp" rm -r --quiet --ignore-unmatch .
cp -R dist/. "$tmp/"
git -C "$tmp" add -A
if git -C "$tmp" diff --cached --quiet; then
  echo "Nothing changed, not deploying."
  exit 0
fi
git -C "$tmp" commit --quiet -m "Deploy flok $rev (syncs via $FLOK_SERVER)"
git -C "$tmp" push --quiet origin "$DEPLOY_BRANCH"
echo "Deployed $rev to https://github.com/$DEPLOY_REPO"
