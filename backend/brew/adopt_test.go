package brew

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"sync/atomic"
	"testing"
)

const adoptCatalogJSON = `[
  {"token":"iterm2","full_token":"iterm2","name":["iTerm2"],"desc":"Terminal emulator","homepage":"https://iterm2.com/","version":"3.7.7","auto_updates":true,
   "artifacts":[{"uninstall":[{"quit":"com.googlecode.iterm2"}]},{"app":["iTerm.app"],"target":"/Applications/iTerm.app"}]},
  {"token":"iterm2@beta","full_token":"iterm2@beta","name":["iTerm2"],"desc":null,"homepage":"https://iterm2.com/","version":"3.7.8beta2","auto_updates":true,
   "artifacts":[{"app":["iTerm.app"],"target":"/Applications/iTerm.app"}]},
  {"token":"tunnelblick","full_token":"tunnelblick","name":["Tunnelblick"],"version":"10.0.3,6610","auto_updates":null,
   "artifacts":[{"app":["Tunnelblick.app"],"target":"/Applications/Tunnelblick.app"}]},
  {"token":"keka","full_token":"keka","name":["Keka"],"version":"1.6.8","auto_updates":null,
   "artifacts":[{"app":["Keka.app"],"target":"/Applications/Keka.app"}]},
  {"token":"thorium","full_token":"thorium","name":["Thorium"],"version":"130.0","auto_updates":null,
   "artifacts":[{"app":["Thorium.app",{"target":"Thorium Browser.app"}],"target":"/Applications/Thorium Browser.app"}]},
  {"token":"renamed-tool","full_token":"renamed-tool","name":["Some Tool"],"version":"2.0","auto_updates":false,
   "artifacts":[{"uninstall":[{"quit":["com.example.sometool","com.example.sometool.helper"]}]},{"app":["Some Tool Pro.app"]}]},
  {"token":"obscure","full_token":"obscure","name":["Obscure Notes"],"version":"1.0","auto_updates":false,
   "artifacts":[{"app":["Obscure.app"]}]},
  {"token":"pkg-only","full_token":"pkg-only","name":["Pkg Only"],"version":"1.0",
   "artifacts":[{"pkg":["PkgOnly.pkg"]}]},
  {"token":"gone","full_token":"gone","name":["Gone"],"version":"1.0","disabled":true,
   "artifacts":[{"app":["Gone.app"]}]},
  {"token":"helper","full_token":"helper","name":["Helper"],"version":"1.0",
   "artifacts":[{"app":["Installer.app/Contents/Helper.app",{"target":"~/Library/Helper.app"}]}]}
]`

func loadTestCatalog(t *testing.T) []catalogCask {
	t.Helper()
	var casks []catalogCask
	if err := json.Unmarshal([]byte(adoptCatalogJSON), &casks); err != nil {
		t.Fatalf("catalog fixture: %v", err)
	}
	return casks
}

func caskByToken(t *testing.T, casks []catalogCask, token string) *catalogCask {
	t.Helper()
	for i := range casks {
		if casks[i].Token == token {
			return &casks[i]
		}
	}
	t.Fatalf("no cask %q in fixture", token)
	return nil
}

func TestAppArtifactNames(t *testing.T) {
	casks := loadTestCatalog(t)
	cases := map[string][]string{
		"iterm2":       {"iTerm.app"},
		"thorium":      {"Thorium Browser.app"}, // renamed via target
		"renamed-tool": {"Some Tool Pro.app"},
		"pkg-only":     nil,
		"helper":       nil, // target outside the app directory
	}
	for token, want := range cases {
		if got := caskByToken(t, casks, token).appArtifactNames(); !reflect.DeepEqual(got, want) {
			t.Errorf("%s: got %v, want %v", token, got, want)
		}
	}

	var nested catalogCask
	_ = json.Unmarshal([]byte(`{"token":"x","artifacts":[{"app":["X1.2/X.app"]}]}`), &nested)
	if got := nested.appArtifactNames(); !reflect.DeepEqual(got, []string{"X.app"}) {
		t.Errorf("subfolder source: got %v", got)
	}
}

func TestQuitBundleIDs(t *testing.T) {
	casks := loadTestCatalog(t)
	if got := caskByToken(t, casks, "iterm2").quitBundleIDs(); !reflect.DeepEqual(got, []string{"com.googlecode.iterm2"}) {
		t.Errorf("single quit: got %v", got)
	}
	want := []string{"com.example.sometool", "com.example.sometool.helper"}
	if got := caskByToken(t, casks, "renamed-tool").quitBundleIDs(); !reflect.DeepEqual(got, want) {
		t.Errorf("quit list: got %v", got)
	}
}

func TestCompareAppVersion(t *testing.T) {
	cases := []struct{ installed, cask, want string }{
		{"3.7.7", "3.7.7", AdoptVersionSame},
		{"2026.3", "2026.3,263.7307.200", AdoptVersionSame},
		{"v1.2", "1.2", AdoptVersionSame},
		{"8.0.2 (build 6302)", "10.0.3,6610", AdoptVersionOlder},
		{"0.0.422", "0.0.423", AdoptVersionOlder},
		{"4.1", "4.0.9", AdoptVersionNewer},
		{"1.0", "1.0.0", AdoptVersionUnknown},
		{"1.0", "latest", AdoptVersionUnknown},
		{"", "1.0", AdoptVersionUnknown},
		{"beta", "gamma", AdoptVersionUnknown},
	}
	for _, c := range cases {
		if got := compareAppVersion(c.installed, c.cask); got != c.want {
			t.Errorf("compareAppVersion(%q, %q) = %q, want %q", c.installed, c.cask, got, c.want)
		}
	}
}

func tokens(candidates []AdoptCandidate) []string {
	out := make([]string, len(candidates))
	for i, c := range candidates {
		out[i] = c.Token
	}
	return out
}

func TestCandidatesFor(t *testing.T) {
	idx := newCatalogIndex(loadTestCatalog(t))

	// Variants: main cask first, @beta second.
	got := idx.candidatesFor(installedApp{FileName: "iTerm.app", BundleID: "com.googlecode.iterm2", Version: "3.7.7"})
	if !reflect.DeepEqual(tokens(got), []string{"iterm2", "iterm2@beta"}) {
		t.Fatalf("iTerm candidates: %v", tokens(got))
	}
	if got[0].MatchKind != AdoptMatchApp || got[0].VersionStatus != AdoptVersionSame || !got[0].AutoUpdates {
		t.Errorf("iterm2 candidate: %+v", got[0])
	}

	// A variant whose version matches beats the main cask.
	got = idx.candidatesFor(installedApp{FileName: "iTerm.app", Version: "3.7.8beta2"})
	if tokens(got)[0] != "iterm2@beta" {
		t.Errorf("version-matching variant should lead: %v", tokens(got))
	}

	// Bundle ID matches even when the .app was renamed by the user.
	got = idx.candidatesFor(installedApp{FileName: "Some Tool.app", BundleID: "COM.EXAMPLE.SOMETOOL", Version: "2.0"})
	if len(got) != 1 || got[0].Token != "renamed-tool" || got[0].MatchKind != AdoptMatchBundleID {
		t.Errorf("bundle id match: %+v", got)
	}

	// Name-only fallback.
	got = idx.candidatesFor(installedApp{FileName: "Obscure Notes.app"})
	if len(got) != 1 || got[0].MatchKind != AdoptMatchName {
		t.Errorf("name match: %+v", got)
	}

	// Disabled and pkg-only casks never match.
	if got := idx.candidatesFor(installedApp{FileName: "Gone.app"}); len(got) != 0 {
		t.Errorf("disabled cask matched: %v", tokens(got))
	}
	if got := idx.candidatesFor(installedApp{FileName: "Pkg Only.app"}); len(got) != 0 {
		t.Errorf("pkg-only cask matched: %v", tokens(got))
	}
}

func TestBuildAdoptResult(t *testing.T) {
	apps := []installedApp{
		{FileName: "iTerm.app", Path: "/Applications/iTerm.app", BundleID: "com.googlecode.iterm2", Version: "3.7.5"},
		{FileName: "Tunnelblick.app", Path: "/Applications/Tunnelblick.app", Version: "8.0.2 (build 6302)"},
		{FileName: "Keka.app", Path: "/Applications/Keka.app", Version: "1.6.8"},
		{FileName: "Obscure Notes.app", Path: "/Applications/Obscure Notes.app"},
		{FileName: "Firefox.app", Path: "/Applications/Firefox.app"},
		{FileName: "Pages.app", Path: "/Applications/Pages.app", AppStore: true},
		{FileName: "Safari.app", Path: "/Applications/Safari.app", BundleID: "com.apple.Safari"},
		{FileName: "Homegrown.app", Path: "/Applications/Homegrown.app", BundleID: "dev.me.homegrown", Version: "0.1"},
	}
	result := buildAdoptResult("/Applications", apps, loadTestCatalog(t), map[string]bool{"firefox.app": true})

	statuses := map[string]string{}
	for _, app := range result.Apps {
		statuses[app.AppName] = app.Status
	}
	want := map[string]string{
		"iTerm":         AdoptStatusReady,           // version differs, but auto_updates
		"Tunnelblick":   AdoptStatusVersionMismatch, // older and no auto_updates
		"Keka":          AdoptStatusReady,           // same version
		"Obscure Notes": AdoptStatusUncertain,
	}
	if !reflect.DeepEqual(statuses, want) {
		t.Errorf("statuses: got %v, want %v", statuses, want)
	}
	if result.Apps[0].AppName != "iTerm" {
		t.Errorf("apps should be sorted case-insensitively, got first %q", result.Apps[0].AppName)
	}
	if result.ManagedCount != 1 || result.SystemCount != 1 {
		t.Errorf("managed=%d system=%d", result.ManagedCount, result.SystemCount)
	}
	if !reflect.DeepEqual(result.AppStoreApps, []string{"Pages"}) {
		t.Errorf("app store apps: %v", result.AppStoreApps)
	}
	if len(result.Unmatched) != 1 || result.Unmatched[0].AppName != "Homegrown" {
		t.Errorf("unmatched: %+v", result.Unmatched)
	}
}

func TestScanAppDir(t *testing.T) {
	dir := t.TempDir()
	mustMkdir := func(p string) {
		if err := os.MkdirAll(p, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	mustMkdir(filepath.Join(dir, "Keka.app", "Contents"))
	mustMkdir(filepath.Join(dir, "Pages.app", "Contents", "_MASReceipt"))
	mustMkdir(filepath.Join(dir, "Utilities"))
	mustMkdir(filepath.Join(dir, ".Hidden.app"))
	mustMkdir(filepath.Join(t.TempDir(), "Linked.app"))
	if err := os.Symlink(filepath.Join(dir, "Keka.app"), filepath.Join(dir, "Linked.app")); err != nil {
		t.Fatal(err)
	}

	reader := func(path string) (map[string]string, error) {
		if filepath.Base(filepath.Dir(filepath.Dir(path))) == "Keka.app" {
			return map[string]string{"CFBundleIdentifier": "com.aone.keka", "CFBundleShortVersionString": "1.6.8"}, nil
		}
		return map[string]string{"CFBundleVersion": "42"}, nil
	}
	apps, err := scanAppDir(dir, reader)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]installedApp{}
	for _, app := range apps {
		got[app.FileName] = app
	}
	if len(got) != 2 {
		t.Fatalf("expected Keka and Pages only, got %v", got)
	}
	if k := got["Keka.app"]; k.BundleID != "com.aone.keka" || k.Version != "1.6.8" || k.AppStore {
		t.Errorf("Keka: %+v", k)
	}
	if p := got["Pages.app"]; !p.AppStore || p.Version != "42" {
		t.Errorf("Pages: %+v", p)
	}
}

func TestParsePlistStrings(t *testing.T) {
	plist := `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDocumentTypes</key>
	<array>
		<dict>
			<key>CFBundleIdentifier</key>
			<string>nested.should.be.ignored</string>
		</dict>
	</array>
	<key>LSRequiresNativeExecution</key>
	<true/>
	<key>CFBundleIdentifier</key>
	<string>com.example.app</string>
	<key>CFBundleShortVersionString</key>
	<string>1.2.3</string>
	<key>LSMinimumSystemVersion</key>
	<string>13.0</string>
</dict>
</plist>`
	got, err := parsePlistStrings([]byte(plist))
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"CFBundleIdentifier":         "com.example.app",
		"CFBundleShortVersionString": "1.2.3",
		"LSMinimumSystemVersion":     "13.0",
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestManagedAppNames(t *testing.T) {
	runner := &fakeRunner{stdout: map[string]string{
		"info --cask --json=v2 --installed": `{"formulae":[],"casks":[
			{"token":"firefox","artifacts":[{"app":["Firefox.app"]}]},
			{"token":"tap/x/thorium","artifacts":[{"app":["Thorium.app",{"target":"Thorium Browser.app"}]}]}
		]}`,
	}}
	got, err := managedAppNames(runner)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]bool{"firefox.app": true, "thorium browser.app": true}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestCaskCatalogLoad(t *testing.T) {
	var requests, notModified atomic.Int32
	var down atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if down.Load() {
			http.Error(w, "unavailable", http.StatusServiceUnavailable)
			return
		}
		if r.URL.Path != "/api/cask.json" {
			http.NotFound(w, r)
			return
		}
		if r.Header.Get("If-None-Match") == `"v1"` {
			notModified.Add(1)
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Set("ETag", `"v1"`)
		_, _ = w.Write([]byte(adoptCatalogJSON))
	}))
	defer server.Close()

	cacheDir := t.TempDir()
	env := []string{"HOMEBREW_API_DOMAIN=" + server.URL + "/api/"}
	newCatalog := func() *caskCatalog {
		c := newCaskCatalog(func() []string { return env })
		c.cacheDir = func() (string, error) { return cacheDir, nil }
		return c
	}

	catalog := newCatalog()
	casks, stale, err := catalog.Load(context.Background())
	if err != nil || stale || len(casks) != 10 {
		t.Fatalf("first load: %d casks, stale=%v, err=%v", len(casks), stale, err)
	}

	// Revalidation uses the ETag.
	if _, stale, err = catalog.Load(context.Background()); err != nil || stale || notModified.Load() != 1 {
		t.Fatalf("revalidate: stale=%v err=%v notModified=%d", stale, err, notModified.Load())
	}

	// A fresh instance picks up the disk cache and its ETag.
	if _, _, err = newCatalog().Load(context.Background()); err != nil || notModified.Load() != 2 {
		t.Fatalf("disk cache: err=%v notModified=%d", err, notModified.Load())
	}

	// Offline: the cached copy is served and flagged stale.
	down.Store(true)
	casks, stale, err = newCatalog().Load(context.Background())
	if err != nil || !stale || len(casks) != 10 {
		t.Fatalf("offline: %d casks, stale=%v, err=%v", len(casks), stale, err)
	}

	// Offline without any cache is an error.
	empty := newCaskCatalog(func() []string { return env })
	empty.cacheDir = func() (string, error) { return t.TempDir(), nil }
	if _, _, err := empty.Load(context.Background()); err == nil {
		t.Fatal("expected an error without network and cache")
	}
}

func TestBuildAdoptArgs(t *testing.T) {
	if got := BuildAdoptArgs("keka", false); !reflect.DeepEqual(got, []string{"install", "--cask", "--adopt", "keka"}) {
		t.Errorf("adopt: %v", got)
	}
	if got := BuildAdoptArgs("keka", true); !reflect.DeepEqual(got, []string{"install", "--cask", "--force", "keka"}) {
		t.Errorf("replace: %v", got)
	}
}

func TestIsAdoptMismatchError(t *testing.T) {
	stderr := "==> Adopting existing App at '/Applications/Tunnelblick.app'\n" +
		"Error: The bundle short version of /opt/homebrew/Caskroom/tunnelblick/10.0.3,6610/Tunnelblick.app is 10.0.3 but is 8.0.2 for /Applications/Tunnelblick.app!\n" +
		"Error: It seems the existing App is different from the one being installed."
	if !IsAdoptMismatchError(stderr) {
		t.Error("mismatch not detected")
	}
	if IsAdoptMismatchError("Error: Download failed") {
		t.Error("false positive")
	}
}

// A cask whose uninstall stanza quits another app (here: Chrome) must not show
// up next to the exact .app match for that app.
func TestCandidatesFor_bundleIDDoesNotAddNoise(t *testing.T) {
	var casks []catalogCask
	_ = json.Unmarshal([]byte(`[
	  {"token":"google-chrome","name":["Google Chrome"],"version":"1","artifacts":[{"uninstall":[{"quit":"com.google.Chrome"}]},{"app":["Google Chrome.app"]}]},
	  {"token":"converter","name":["Converter"],"version":"1","artifacts":[{"uninstall":[{"quit":["com.google.Chrome","com.example.converter"]}]},{"app":["Converter.app"]}]}
	]`), &casks)
	got := newCatalogIndex(casks).candidatesFor(installedApp{FileName: "Google Chrome.app", BundleID: "com.google.Chrome"})
	if !reflect.DeepEqual(tokens(got), []string{"google-chrome"}) {
		t.Errorf("got %v", tokens(got))
	}
}

func TestAppManagementDeniedPath(t *testing.T) {
	stderr := "==> Adopting existing App at '/Applications/Keka.app'\n" +
		"chgrp: /Applications/Keka.app/Contents/CodeResources: Operation not permitted\n" +
		"chgrp: /Applications/Keka.app/Contents/MacOS: Operation not permitted\n"
	if path, ok := AppManagementDeniedPath(stderr); !ok || path != "/Applications/Keka.app" {
		t.Errorf("got %q, %v", path, ok)
	}
	if path, ok := AppManagementDeniedPath("chgrp: /Applications/Visual Studio Code.app: Operation not permitted"); !ok || path != "/Applications/Visual Studio Code.app" {
		t.Errorf("bundle root: got %q, %v", path, ok)
	}
	for _, other := range []string{
		"Error: It seems the existing App is different from the one being installed.",
		"rm: /opt/homebrew/Caskroom/foo/1.0/file: Operation not permitted",
	} {
		if _, ok := AppManagementDeniedPath(other); ok {
			t.Errorf("false positive for %q", other)
		}
	}
}
