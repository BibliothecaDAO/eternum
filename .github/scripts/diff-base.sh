#!/usr/bin/env bash
# Prints the commit a run's changes are measured from. A stream branch lands every commit it carries, so its run
# must cover all of them: it is measured from its merge-base with the integration branch, never only from its last
# push. A pull request is measured from its base. The integration branch and next run every area, so their base is
# never read. A base that cannot be resolved falls back to origin/next, which checks more, never less.
# Inputs (environment): EVENT, PR_BASE_SHA, HEAD_SHA; LANDING_BRANCH defaults to the integration branch. Needs full
# history (actions/checkout with fetch-depth: 0).
set -euo pipefail

landing=${LANDING_BRANCH:-native-world-foundation}
base=""
if [ "$EVENT" = pull_request ]; then
  base=$PR_BASE_SHA
elif git fetch --quiet --no-tags origin "$landing" 2>/dev/null; then
  base=$(git merge-base "$HEAD_SHA" FETCH_HEAD || true)
fi
if [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  base=origin/next
fi
echo "$base"
