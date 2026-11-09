#!/usr/bin/env bash
# Run from a repository checkout in CI. Installs a copy with Windows line endings, then updates it twice from a local
# upstream, using the real pnpm, build and mografy.cmd. Fails on the first thing a Windows user would run into.
set -euo pipefail

git config --global core.autocrlf true
git config --global user.name 'Update sandbox'
git config --global user.email 'sandbox@example.test'

work="$RUNNER_TEMP/sandbox"
mkdir -p "$work" "$APPDATA/npm"
export PATH="$APPDATA/npm:$PATH"
git clone -q --bare . "$work/remote.git"
# A pull request's checkout has no branch; the upstream needs one to update from.
git -C "$work/remote.git" update-ref refs/heads/sandbox HEAD
git -C "$work/remote.git" symbolic-ref HEAD refs/heads/sandbox
git clone -q "$work/remote.git" "$work/installed"
git clone -q "$work/remote.git" "$work/author"

clean() {
  local status
  status="$(git -C "$work/installed" status --porcelain)"
  if [ -n "$status" ]; then echo "Checkout is not clean after $1:"; echo "$status"; exit 1; fi
  echo "ok: clean after $1"
}

cd "$work/installed"
pnpm install --frozen-lockfile
clean 'pnpm install'
pnpm build
clean 'a second build'

round() {
  local name="SANDBOX_ROUND_$1"
  cd "$work/author"
  echo "export const $name = '$1';" >> packages/cli/src/paths.ts
  git add -A
  git commit -q -m "sandbox round $1"
  git push -q
  cd "$work/installed"
  node packages/cli/bin/mografy.js update
  [ "$(git rev-parse HEAD)" = "$(git -C "$work/author" rev-parse HEAD)" ] || { echo "HEAD did not move in round $1"; exit 1; }
  grep -q "$name" packages/cli/dist/paths.js || { echo "dist was not rebuilt in round $1"; exit 1; }
  echo "ok: round $1 updated and rebuilt"
  clean "update round $1"
}
round 1
round 2

cd "$work"
cmd //c "where mografy"
[ "$(cmd //c "mografy --version" | tr -d '\r')" = '0.1.0' ] || { echo 'mografy.cmd did not run'; exit 1; }
echo 'ok: mografy.cmd runs outside the checkout'
if cmd //c "mografy dev no-such-project --no-open"; then echo 'mografy.cmd lost the exit code'; exit 1; fi
echo 'ok: mografy.cmd passes on the exit code'
