#!/usr/bin/env bash
# Prints the commit a pull request's changes are measured from: where its head branched from its base (their
# merge-base), so changes the base gained after the branch was cut are not counted as the pull request's own. It fetches
# only the history that needs, into the scope job's one-commit shallow checkout. A push to next runs every area and
# never reads a base. Prints nothing when no base can be resolved; the caller then runs every area, which checks more,
# never less.
# Inputs (environment): PR_BASE_SHA, HEAD_SHA.
set -euo pipefail

# Commits and trees only: a list of changed paths never reads a file's contents.
deepen=()
[ "$(git rev-parse --is-shallow-repository)" = true ] && deepen=(--unshallow)
if git fetch --quiet --no-tags --filter=blob:none "${deepen[@]}" origin "$PR_BASE_SHA" "$HEAD_SHA" 2>/dev/null; then
  git merge-base "$PR_BASE_SHA" "$HEAD_SHA" 2>/dev/null || true
fi
