#!/usr/bin/env bash
#
# Refresh the `upstream` branch with a snapshot of Payload's own blank template
# at a given release, so that upstream changes can be merged into this fork with
# a real three-way diff. See docs/upstream-sync.md.
#
# Usage: scripts/sync-upstream.sh 3.89.0

set -euo pipefail

UPSTREAM_REPO="https://github.com/payloadcms/payload.git"
UPSTREAM_PATH="templates/blank"
BRANCH="upstream"

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "usage: $0 <payload version>   e.g. $0 3.89.0" >&2
  exit 1
fi

TAG="v${VERSION#v}"
VERSION="${TAG#v}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
WORKTREE="$TMP/worktree"
trap 'git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" 2>/dev/null || true; rm -rf "$TMP"' EXIT

echo "==> fetching $UPSTREAM_PATH at $TAG"
git clone --quiet --depth 1 --branch "$TAG" --filter=blob:none --sparse "$UPSTREAM_REPO" "$TMP/payload"
git -C "$TMP/payload" sparse-checkout set --no-cone "$UPSTREAM_PATH"

SNAPSHOT="$TMP/payload/$UPSTREAM_PATH"

if [ ! -d "$SNAPSHOT" ]; then
  echo "error: $UPSTREAM_PATH does not exist at $TAG" >&2
  exit 1
fi

# Inside the monorepo the template depends on "workspace:*". Pin those to the
# release being synced, or every dependency diff would be meaningless.
echo "==> pinning workspace:* to $VERSION"
python3 - "$SNAPSHOT/package.json" "$VERSION" <<'PY'
import json
import sys
from collections import OrderedDict

path, version = sys.argv[1], sys.argv[2]

with open(path) as handle:
    pkg = json.load(handle, object_pairs_hook=OrderedDict)

for section in ('dependencies', 'devDependencies', 'peerDependencies'):
    for name, spec in pkg.get(section, {}).items():
        if isinstance(spec, str) and spec.startswith('workspace:'):
            pkg[section][name] = version

with open(path, 'w') as handle:
    json.dump(pkg, handle, indent=2)
    handle.write('\n')
PY

echo "==> updating the $BRANCH branch"
if git -C "$REPO_ROOT" show-ref --quiet "refs/heads/$BRANCH"; then
  git -C "$REPO_ROOT" worktree add --quiet "$WORKTREE" "$BRANCH"
  find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
else
  git -C "$REPO_ROOT" worktree add --quiet --orphan -b "$BRANCH" "$WORKTREE"
fi

cp -a "$SNAPSHOT/." "$WORKTREE/"
rm -rf "$WORKTREE/.git/"*.lock 2>/dev/null || true

git -C "$WORKTREE" add -A

if git -C "$WORKTREE" diff --cached --quiet; then
  echo "==> $BRANCH already matches $TAG, nothing to do"
  exit 0
fi

git -C "$WORKTREE" commit --quiet -m "payload $UPSTREAM_PATH $TAG"

echo
echo "$BRANCH is now at $TAG. Merge it into your branch with:"
echo
echo "    git merge $BRANCH"
echo
