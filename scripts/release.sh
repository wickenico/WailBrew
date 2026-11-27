#!/usr/bin/env bash
set -euo pipefail

# ===========================
# WailBrew Release
# Preflight -> Sign -> Zip -> Notarize -> Staple -> Re-Zip -> Tag -> GitHub Release
# ===========================
#
# Normally run via `make release`, which runs the preflight checks, builds the
# app and then this script. Homebrew's BrewTestBot bumps the official
# `wailbrew` cask once the release (with its zip) is published.
#
# Voraussetzungen (einmalig):
#   1) Apple-ID App-Passwort & notarytool-Profil:
#        xcrun notarytool store-credentials "wailbrew-notary" \
#          --apple-id "deine.apple.id@example.com" \
#          --team-id "TEAMID" \
#          --password "app-spezifisches-passwort"
#   2) Developer ID Application Zertifikat in der Login-Keychain.
#   3) GitHub CLI angemeldet: gh auth login
#
# Aufruf:
#   scripts/release.sh --preflight <VERSION>   # nur prüfen, nichts verändern
#   scripts/release.sh <VERSION> [APP_PATH]    # signieren, notarisieren, veröffentlichen
#
# Optionale Umgebungsvariablen:
#   IDENTITY="Developer ID Application: Dein Name (TEAMID)"
#   NOTARY_PROFILE="wailbrew-notary"
#   NOTES_FILE="path/to/notes.md"   # eigene Release-Notes statt der generierten
#   YES=1                           # ohne Rückfrage veröffentlichen

log()  { printf "\n\033[1;34m[INFO]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[WARN]\033[0m %s\n" "$*"; }
die()  { printf "\n\033[1;31m[ERR]\033[0m  %s\n" "$*"; exit 1; }

PREFLIGHT_ONLY=0
if [[ "${1:-}" == "--preflight" ]]; then
  PREFLIGHT_ONLY=1
  shift
fi

VERSION="${1:-}"
APP="${2:-build/bin/WailBrew.app}"
[[ -n "$VERSION" ]] || die "Usage: $0 [--preflight] <VERSION> [APP_PATH]"

TAG="v${VERSION}"
IDENTITY="${IDENTITY:-}"
NOTARY_PROFILE="${NOTARY_PROFILE:-wailbrew-notary}"
ZIP="releases/wailbrew-${TAG}.zip"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ---------- Preflight: fail before the long build, never after tagging ----------
preflight() {
  log "Prüfe Voraussetzungen für ${TAG}…"

  command -v gh >/dev/null || die "GitHub CLI (gh) fehlt: brew install gh"
  gh auth status >/dev/null 2>&1 || die "gh ist nicht angemeldet: gh auth login"

  local pkg_version
  pkg_version="$(node "${SCRIPT_DIR}/../get-version.js")"
  [[ "$pkg_version" == "$VERSION" ]] \
    || die "Version ${VERSION} passt nicht zu frontend/package.json (${pkg_version}). Erst 'make bump' / 'make bump-minor'?"

  [[ "$(git branch --show-current)" == "main" ]] || die "Releases nur von 'main' (aktuell: $(git branch --show-current))."
  [[ -z "$(git status --porcelain --untracked-files=no)" ]] || die "Uncommittete Änderungen vorhanden."

  git fetch --quiet origin main || die "git fetch origin main fehlgeschlagen."
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] \
    || die "Lokales main entspricht nicht origin/main (erst pushen bzw. pullen)."

  # Ask GitHub directly: local tags can diverge from the remote ones.
  if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null \
    || [[ -n "$(git ls-remote --tags origin "refs/tags/${TAG}")" ]]; then
    die "Tag ${TAG} existiert bereits (lokal oder auf GitHub)."
  fi
  if gh release view "$TAG" >/dev/null 2>&1; then
    die "GitHub-Release ${TAG} existiert bereits."
  fi

  security find-identity -p codesigning -v 2>/dev/null | grep -q "Developer ID Application" \
    || die "Keine 'Developer ID Application' Identität in der Keychain."

  log "Preflight ok."
}

preflight
[[ "$PREFLIGHT_ONLY" == 1 ]] && exit 0

[[ -d "$APP" ]] || die "App-Bundle nicht gefunden: $APP (erst 'make build' ausführen?)"
mkdir -p releases

# ---------- Architectures: releases must run on Apple Silicon and Intel ----------
BIN="${APP}/Contents/MacOS/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "${APP}/Contents/Info.plist")"
ARCHS="$(lipo -archs "$BIN")"
for arch in arm64 x86_64; do
  [[ " $ARCHS " == *" $arch "* ]] \
    || die "Binary enthält kein ${arch} (gefunden: ${ARCHS}). Universal bauen: 'make build-universal'."
done
log "Architekturen: ${ARCHS}"

# ---------- Sign ----------
if [[ -z "${IDENTITY}" ]]; then
  IDENTITY=$(security find-identity -p codesigning -v | grep "Developer ID Application" | head -n1 | sed -E 's/.*"(.+)"/\1/')
fi
log "Verwende Signatur-Identität: $IDENTITY"

log "Signiere App (codesign --deep --options runtime --timestamp)…"
codesign --force --deep --options runtime --timestamp --sign "$IDENTITY" "$APP"

log "Verifiziere Signatur…"
codesign --verify --deep --strict --verbose=2 "$APP" || die "codesign verify fehlgeschlagen"
spctl --assess --type execute --verbose=4 "$APP" || warn "spctl Warnung (ok, wird durch Notarisierung behoben)"

# ---------- Notarize ----------
log "Erzeuge ZIP für die Notarisierung: $ZIP"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"

log "Reiche ZIP zur Notarisierung ein (Profil: $NOTARY_PROFILE)…"
xcrun notarytool submit "$ZIP" --keychain-profile "$NOTARY_PROFILE" --wait || die "Notarisierung fehlgeschlagen"

log "Stapele Notarisierung ins App-Bundle…"
xcrun stapler staple "$APP" || die "Stapling fehlgeschlagen"
xcrun stapler validate "$APP" || warn "Stapler validate Warnung"

log "Erzeuge finales ZIP (gestapeltes Bundle): $ZIP"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"
SHA=$(shasum -a 256 "$ZIP" | awk '{print $1}')
log "SHA256: ${SHA}"

# ---------- Release notes ----------
NOTES="releases/notes-${TAG}.md"
if [[ -n "${NOTES_FILE:-}" ]]; then
  cp "$NOTES_FILE" "$NOTES"
else
  "${SCRIPT_DIR}/release-notes.sh" "$VERSION" > "$NOTES"
fi

if [[ "${YES:-}" != 1 ]]; then
  while true; do
    printf "\n----- Release-Notes %s -----\n" "$TAG"
    cat "$NOTES"
    printf -- "----------------------------\n"
    read -r -p "${TAG} mit ${ZIP} veröffentlichen? [y]es / [e]dit / [N]o: " answer
    case "$answer" in
      y|Y|yes) break ;;
      e|E) "${VISUAL:-${EDITOR:-nano}}" "$NOTES" ;;
      *) die "Abgebrochen. Signiertes ZIP liegt in $ZIP; nichts wurde getaggt oder veröffentlicht." ;;
    esac
  done
fi

# ---------- Tag + GitHub release ----------
log "Erstelle und pushe Tag ${TAG}…"
git tag "$TAG"
git push --quiet origin "$TAG"

log "Erstelle GitHub-Release ${TAG}…"
gh release create "$TAG" "$ZIP" --verify-tag --title "$TAG" --notes-file "$NOTES"

log "FERTIG: $(gh release view "$TAG" --json url --jq .url)"
log "Homebrew (BrewTestBot) aktualisiert den offiziellen Cask automatisch."
