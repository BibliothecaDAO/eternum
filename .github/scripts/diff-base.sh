#!/usr/bin/env bash
# Prints the commit a pull request's changes are measured from: where its head branched from its base (their
# merge-base), so changes the base gained after the branch was cut are not counted as the pull request's own. It fetches
# only the history that needs, into the scope job's one-commit shallow checkout. A push uses its before SHA directly,
# covering every commit in that push. Prints nothing when no base can be resolved; the caller rejects such a push
# and checks every area for a pull request.
# Inputs (environment): EVENT, PUSH_BASE_SHA or PR_BASE_SHA, HEAD_SHA.
set -euo pipefail

base=${PR_BASE_SHA:-}
if [ "${EVENT:-}" = push ]; then base=${PUSH_BASE_SHA:-}; fi
if [ -z "$base" ] || [[ "$base" =~ ^0+$ ]]; then exit 0; fi

# Commits and trees only: a list of changed paths never reads a file's contents.
deepen=()
[ "$(git rev-parse --is-shallow-repository)" = true ] && deepen=(--unshallow)
if git fetch --quiet --no-tags --filter=blob:none "${deepen[@]}" origin "$base" "$HEAD_SHA" 2>/dev/null; then
  if [ "${EVENT:-}" = push ]; then
    git rev-parse --verify "$base^{commit}" 2>/dev/null || true
  else
    git merge-base "$base" "$HEAD_SHA" 2>/dev/null || true
  fi
fi
