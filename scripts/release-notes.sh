#!/usr/bin/env bash
set -euo pipefail

# Prints the GitHub release notes (Markdown) for VERSION: commits since the
# previous tag, minus version bumps, chores and Dependabot, which get their own
# section, plus a full-changelog link.
#
# Usage: scripts/release-notes.sh <VERSION> [PREV_TAG] [END_REF]
#   PREV_TAG defaults to the newest tag before END_REF other than v<VERSION>.
#   END_REF defaults to HEAD.

VERSION="${1:?Usage: $0 <VERSION> [PREV_TAG] [END_REF]}"
END_REF="${3:-HEAD}"
PREV_TAG="${2:-$(git describe --tags --abbrev=0 --exclude "v${VERSION}" "${END_REF}" 2>/dev/null || true)}"
REPO_URL="https://github.com/wickenico/WailBrew"

if [[ -z "$PREV_TAG" ]]; then
  echo "No previous tag found; cannot generate release notes." >&2
  exit 1
fi

RANGE="${PREV_TAG}..${END_REF}"

CHANGES=$(git log "$RANGE" --reverse --pretty=format:"%an|%s (%h)" \
  --invert-grep -E --grep="[Bb]ump.*[0-9]+\.[0-9]+\.[0-9]+|^[Vv]ersion.*[0-9]+\.[0-9]+\.[0-9]+|^[Cc]hore" \
  | grep -vE "^dependabot(-preview)?\[bot\]\|" | sed 's/^[^|]*|/- /' || true)

DEPENDENCIES=$(git log "$RANGE" --reverse --pretty=format:"- %s (%h)" \
  --author="dependabot\[bot\]" --author="dependabot-preview\[bot\]" || true)

echo "## Changes"
echo
echo "${CHANGES:-No changes detected}"
if [[ -n "$DEPENDENCIES" ]]; then
  echo
  echo "## Dependencies"
  echo
  echo "$DEPENDENCIES"
fi
echo
echo "**Full Changelog**: ${REPO_URL}/compare/${PREV_TAG}...v${VERSION}"
