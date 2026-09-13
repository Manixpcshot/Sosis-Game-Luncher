#!/usr/bin/env bash
# Sosis Launcher — push commits + ALWAYS publish/update the GitHub Release for
# the current version in package.json (creates the release/tag if missing,
# replaces same-named assets, marks it as latest).
#
# Usage (run on Windows via Git-Bash after build-setup.bat, or on Linux/macOS):
#   GITHUB_TOKEN=<your-token> bash scripts/push-and-upload.sh
# The token is never stored anywhere by this script.
set -euo pipefail
cd "$(dirname "$0")/.."          # repo root (script lives in scripts/)

: "${GITHUB_TOKEN:?Set GITHUB_TOKEN first}"
REPO="Manixpcshot/Sosis-Game-Luncher"
VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"
API="https://api.github.com/repos/${REPO}"
AUTH="Authorization: Bearer ${GITHUB_TOKEN}"

echo "==> ensure repo is PRIVATE"
curl -sfL -X PATCH -H "$AUTH" -H "Accept: application/vnd.github+json" \
  -d '{"private":true}' "${API}" -o /tmp/repo.json \
  && python3 -c "import json;d=json.load(open('/tmp/repo.json'));print('   repo private =', d.get('private'))" \
  || echo "   (could not change privacy — continuing)"

echo "==> git push (main)"
if ! git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" HEAD:main; then
  echo "   WARNING: push failed. If the error mentions '.github/workflows',"
  echo "   your token needs the 'workflow' scope too. Continuing with uploads..."
fi
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "refs/tags/${TAG}" 2>/dev/null || echo "   (tag ${TAG} already on remote or push skipped)"

echo "==> ensure release ${TAG}"
RELEASE_ID=$(curl -sfL -H "$AUTH" "${API}/releases/tags/${TAG}" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])" 2>/dev/null || true)
NOTES="See README.md — built from commit $(git rev-parse --short HEAD)."
if [ -z "${RELEASE_ID}" ]; then
  git tag -f "${TAG}" >/dev/null 2>&1 || true
  git push -f "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "refs/tags/${TAG}" >/dev/null 2>&1 || true
  RELEASE_ID=$(curl -sfL -X POST -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"tag_name\":\"${TAG}\",\"name\":\"Sosis Launcher ${TAG}\",\"body\":\"${NOTES}\",\"make_latest\":\"true\",\"draft\":false,\"prerelease\":false}" \
    "${API}/releases" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
  echo "   created release id ${RELEASE_ID}"
else
  curl -sfL -X PATCH -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"name\":\"Sosis Launcher ${TAG}\",\"make_latest\":\"true\"}" \
    "${API}/releases/${RELEASE_ID}" >/dev/null
  echo "   reusing release id ${RELEASE_ID}"
fi

upload_asset() { # $1 = file path
  local f="$1" name old
  [ -f "$f" ] || { echo "   skip (missing): $f"; return 0; }
  name="$(basename "$f")"
  echo "==> upload ${name}"
  old=$(curl -sfL -H "$AUTH" "${API}/releases/${RELEASE_ID}/assets" \
    | python3 -c "import sys,json;[print(a['id']) for a in json.load(sys.stdin) if a['name']=='${name}']" || true)
  if [ -n "${old}" ]; then
    curl -sfL -X DELETE -H "$AUTH" "${API}/releases/assets/${old}" >/dev/null && echo "   replaced old asset"
  fi
  curl -sfL -X POST -H "$AUTH" -H "Content-Type: application/octet-stream" \
    --data-binary "@${f}" \
    "https://uploads.github.com/repos/${REPO}/releases/${RELEASE_ID}/assets?name=${name}" \
    -o /tmp/asset.json && echo "   OK: https://github.com/${REPO}/releases/download/${TAG}/${name}"
}

upload_asset "dist/SosisLauncherSetup.exe"
upload_asset "dist/SosisLauncherSetup.msi"
upload_asset "dist/SosisLauncher-${VERSION}-win64-portable.zip"
upload_asset "dist/SosisLauncher-WebPlatform-cPanel-${VERSION}.zip"
upload_asset "dist/latest.json"
upload_asset "dist/datasetup-manifest.json"

echo "DONE — release ${TAG} is up to date."
