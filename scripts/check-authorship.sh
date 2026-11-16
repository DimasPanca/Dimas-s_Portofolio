#!/usr/bin/env bash
# PRD HR-1 guard: every commit in the range is authored by the owner and carries no attribution trailers.
# Usage: AUTHOR_NAME=... AUTHOR_EMAIL=... scripts/check-authorship.sh <base>..<head>
set -euo pipefail
range="${1:-HEAD}"
: "${AUTHOR_NAME:?AUTHOR_NAME is required}"
: "${AUTHOR_EMAIL:?AUTHOR_EMAIL is required}"
fail=0
for sha in $(git rev-list "$range"); do
  an=$(git show -s --format=%an "$sha")
  ae=$(git show -s --format=%ae "$sha")
  cn=$(git show -s --format=%cn "$sha")
  ce=$(git show -s --format=%ce "$sha")
  if git show -s --format=%B "$sha" | grep -qiE '^co-authored-by:|generated (with|by)'; then
    echo "FAIL $sha: forbidden attribution in message"
    fail=1
  fi
  if [ "$an" != "$AUTHOR_NAME" ] || [ "$ae" != "$AUTHOR_EMAIL" ]; then
    echo "FAIL $sha: author is '$an <$ae>'"
    fail=1
  fi
  if ! { [ "$cn" = "$AUTHOR_NAME" ] && [ "$ce" = "$AUTHOR_EMAIL" ]; } && [ "$ce" != "noreply@github.com" ]; then
    echo "FAIL $sha: committer is '$cn <$ce>'"
    fail=1
  fi
done
if [ "$fail" -eq 0 ]; then echo "authorship OK for $range"; fi
exit "$fail"
