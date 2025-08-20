#!/usr/bin/env bash
set -euo pipefail

# ===========================
# WailBrew Release Helper
# Sign -> Zip -> Notarize -> Staple -> Re-Zip -> SHA256
# Optional: Cask-Datei (homebrew-wailbrew) aktualisieren
# ===========================
#
# Voraussetzungen (einmalig):
#   1) Apple-ID App-Passwort & notarytool-Profile:
#        xcrun notarytool store-credentials "wailbrew-notary" \
#          --apple-id "deine.apple.id@example.com" \
#          --team-id "TEAMID" \
#          --password "app-spezifisches-passwort"
#   2) Developer ID Application Zertifikat in Login-Keychain.
#
# Aufruf:
#   ./release.sh <VERSION> [APP_PATH]
#
# Beispiele:
#   ./release.sh 0.6.2
#   ./release.sh 0.6.2 build/bin/WailBrew.app
#
# Optionale Umgebungsvariablen:
#   IDENTITY="Developer ID Application: Dein Name (TEAMID)"
#   NOTARY_PROFILE="wailbrew-notary"
#   CASK_FILE="../homebrew-wailbrew/Casks/wailbrew.rb"   # falls du automatisch Version+SHA setzen willst
#   BUNDLE_ID_HINT="io.github.wickenico.wailbrew"        # nur für Logs/Checks
#
# Hinweis:
#   Nach Erfolg das ZIP als Release-Asset hochladen.
#   Falls CASK_FILE gesetzt ist, wird Version & SHA direkt ersetzt (Backup .bak wird angelegt).

VERSION="${1:-}"
APP="${2:-build/bin/WailBrew.app}"

if [[ -z "${VERSION}" ]]; then
  echo "Usage: $0 <VERSION> [APP_PATH]"
  exit 1
fi

IDENTITY="${IDENTITY:-}"
NOTARY_PROFILE="${NOTARY_PROFILE:-wailbrew-notary}"
ZIP="wailbrew-v${VERSION}.zip"

log()  { printf "\n\033[1;34m[INFO]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[WARN]\033[0m %s\n" "$*"; }
die()  { printf "\n\033[1;31m[ERR]\033[0m  %s\n" "$*"; exit 1; }

[[ -d "$APP" ]] || die "App-Bundle nicht gefunden: $APP (erst 'make' oder 'wails build' ausführen?)"

# 1) Developer-ID-Identität ermitteln (falls nicht vorgegeben)
if [[ -z "${IDENTITY}" ]]; then
  log "Suche Developer ID Application in der Keychain…"
  if ! security find-identity -p codesigning -v >/tmp/_ids 2>/dev/null; then
    die "Keine Codesigning-Identitäten gefunden (Zertifikat korrekt installiert?)"
  fi
  if ! grep -q "Developer ID Application" /tmp/_ids; then
    cat /tmp/_ids
    die "Keine 'Developer ID Application' Identität gefunden."
  fi
  # Nimm die erste passende Identität
  IDENTITY=$(grep "Developer ID Application" /tmp/_ids | head -n1 | sed -E 's/.*"(.+)"/\1/')
fi
log "Verwende Signatur-Identität: $IDENTITY"

# (Optional) Bundle-ID-Check fürs Log
if [[ -n "${BUNDLE_ID_HINT:-}" ]]; then
  BID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Contents/Info.plist" 2>/dev/null || echo "")
  [[ -n "$BID" ]] && log "Bundle Identifier: $BID" || warn "Konnte Bundle ID nicht lesen."
fi

# 2) Signieren
log "Signiere App (codesign --deep --options runtime --timestamp)…"
codesign --force --deep --options runtime --timestamp --sign "$IDENTITY" "$APP"

log "Verifiziere Signatur…"
codesign --verify --deep --strict --verbose=2 "$APP" || die "codesign verify fehlgeschlagen"
spctl --assess --type execute --verbose=4 "$APP" || warn "spctl Warnung (ok, wird durch Notarisierung behoben)"

# 3) Erstes ZIP erstellen (für Notarisierung)
log "Erzeuge ZIP: $ZIP"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"

# 4) Notarisieren
log "Reiche ZIP zur Notarisierung ein (Profil: $NOTARY_PROFILE)…"
xcrun notarytool submit "$ZIP" --keychain-profile "$NOTARY_PROFILE" --wait || die "Notarisierung fehlgeschlagen"

# 5) Stapeln
log "Stapele Notarisierung ins App-Bundle…"
xcrun stapler staple "$APP" || die "Stapling fehlgeschlagen"
xcrun stapler validate "$APP" || warn "Stapler validate Warnung"

# 6) Finales ZIP (gestapeltes Bundle!)
log "Erzeuge finales ZIP (gestapeltes Bundle): $ZIP"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"

# 7) SHA256 ausgeben
log "Berechne SHA256…"
SHA=$(shasum -a 256 "$ZIP" | awk '{print $1}')
echo ""
echo "=============================="
echo "Version : ${VERSION}"
echo "ZIP     : ${ZIP}"
echo "SHA256  : ${SHA}"
echo "=============================="
echo ""

# 8) (Optional) Cask-Datei aktualisieren
if [[ -n "${CASK_FILE:-}" ]]; then
  if [[ -f "$CASK_FILE" ]]; then
    log "Aktualisiere Cask-Datei: $CASK_FILE"
    cp "$CASK_FILE" "${CASK_FILE}.bak"

    # Version ersetzen: version "x.y.z"
    sed -i '' -E "s/(^ *version \")([^\"]+)(\".*)/\1${VERSION}\3/" "$CASK_FILE"

    # sha256 ersetzen: sha256 "…"
    sed -i '' -E "s/(^ *sha256 \")([a-f0-9]+)(\".*)/\1${SHA}\3/" "$CASK_FILE"

    echo "→ Änderungsdiff:"
    git -C "$(dirname "$CASK_FILE")" --no-pager diff -- "$CASK_FILE" || true
    echo ""
    echo "Jetzt committen & pushen, z. B.:"
    echo "  cd $(dirname "$CASK_FILE")"
    echo "  git add $(basename "$CASK_FILE") && git commit -m \"Bump wailbrew to ${VERSION}\" && git push"
  else
    warn "CASK_FILE gesetzt, aber nicht gefunden: $CASK_FILE (überspringe Update)"
  fi
fi

log "FERTIG. Lade nun $ZIP als Release-Asset hoch und (falls gesetzt) pushe das Cask-Update."
