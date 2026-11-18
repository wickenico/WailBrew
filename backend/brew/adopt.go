package brew

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"unicode"
)

// "Adoptable apps" finds applications in the cask app directory that were
// installed outside Homebrew and matches them to casks, so they can be brought
// under Homebrew management with `brew install --cask --adopt`.
//
// Homebrew's --adopt only skips the copy when the existing bundle's
// CFBundleShortVersionString and CFBundleVersion equal those of the downloaded
// cask, unless the cask is marked auto_updates (then it adopts unconditionally).
// The statuses computed here mirror that rule as closely as possible without
// downloading anything; the actual brew run stays authoritative.

// Match kinds, strongest first.
const (
	AdoptMatchApp      = "app"      // .app file name equals the cask's app artifact
	AdoptMatchBundleID = "bundleId" // bundle identifier listed in the cask's uninstall quit stanza
	AdoptMatchName     = "name"     // only the display name / token looks alike
)

// Version relation of the installed app to the cask version.
const (
	AdoptVersionSame    = "same"
	AdoptVersionOlder   = "older" // installed app is older than the cask
	AdoptVersionNewer   = "newer" // installed app is newer than the cask
	AdoptVersionUnknown = "unknown"
)

// App statuses derived from the recommended candidate.
const (
	AdoptStatusReady           = "ready"           // `--adopt` is expected to succeed
	AdoptStatusVersionMismatch = "versionMismatch" // `--adopt` will likely refuse; replacing is the fallback
	AdoptStatusUncertain       = "uncertain"       // no exact cask match, only a similar name
)

// AdoptCandidate is a cask that could own an installed app.
type AdoptCandidate struct {
	Token         string `json:"token"`
	FullToken     string `json:"fullToken"`
	Name          string `json:"name"`
	Desc          string `json:"desc"`
	Homepage      string `json:"homepage"`
	Version       string `json:"version"`
	AutoUpdates   bool   `json:"autoUpdates"`
	Deprecated    bool   `json:"deprecated"`
	MatchKind     string `json:"matchKind"`
	VersionStatus string `json:"versionStatus"`
}

// AdoptableApp is an installed app with at least one matching cask.
type AdoptableApp struct {
	AppName    string           `json:"appName"`
	Path       string           `json:"path"`
	BundleID   string           `json:"bundleId"`
	Version    string           `json:"version"`
	Status     string           `json:"status"`
	Candidates []AdoptCandidate `json:"candidates"`
}

// UnmatchedApp is an installed app no cask could be found for.
type UnmatchedApp struct {
	AppName  string `json:"appName"`
	Path     string `json:"path"`
	BundleID string `json:"bundleId"`
	Version  string `json:"version"`
}

// AdoptScanResult is the outcome of scanning the app directory.
type AdoptScanResult struct {
	AppDir       string         `json:"appDir"`
	Apps         []AdoptableApp `json:"apps"`
	Unmatched    []UnmatchedApp `json:"unmatched"`
	ManagedCount int            `json:"managedCount"`
	AppStoreApps []string       `json:"appStoreApps"`
	SystemCount  int            `json:"systemCount"`
	CatalogStale bool           `json:"catalogStale"`
}

// catalogCask is the subset of a cask entry (formulae.brew.sh/api/cask.json or
// `brew info --cask --json=v2`) needed for matching.
type catalogCask struct {
	Token       string                       `json:"token"`
	FullToken   string                       `json:"full_token"`
	Name        []string                     `json:"name"`
	Desc        *string                      `json:"desc"`
	Homepage    string                       `json:"homepage"`
	Version     string                       `json:"version"`
	AutoUpdates *bool                        `json:"auto_updates"`
	Deprecated  bool                         `json:"deprecated"`
	Disabled    bool                         `json:"disabled"`
	Artifacts   []map[string]json.RawMessage `json:"artifacts"`
}

// installedApp describes a bundle found in the app directory.
type installedApp struct {
	FileName string // "iTerm.app"
	Path     string
	BundleID string
	Version  string
	AppStore bool
}

// appArtifactNames returns the .app file names a cask places in the app
// directory. Targets outside the app directory (absolute or ~ paths) are
// skipped because --adopt would not look for them there.
func (c *catalogCask) appArtifactNames() []string {
	var names []string
	for _, artifact := range c.Artifacts {
		raw, ok := artifact["app"]
		if !ok {
			continue
		}
		var entries []json.RawMessage
		if err := json.Unmarshal(raw, &entries); err != nil {
			continue
		}
		var sources []string
		target := ""
		for _, entry := range entries {
			var source string
			if err := json.Unmarshal(entry, &source); err == nil {
				sources = append(sources, source)
				continue
			}
			var opts struct {
				Target string `json:"target"`
			}
			if err := json.Unmarshal(entry, &opts); err == nil && opts.Target != "" {
				target = opts.Target
			}
		}
		if target != "" {
			if !strings.ContainsAny(target, "/~$") {
				names = append(names, target)
			}
			continue
		}
		for _, source := range sources {
			names = append(names, filepath.Base(source))
		}
	}
	return names
}

// quitBundleIDs returns the bundle identifiers from the uninstall quit stanza.
func (c *catalogCask) quitBundleIDs() []string {
	var ids []string
	for _, artifact := range c.Artifacts {
		raw, ok := artifact["uninstall"]
		if !ok {
			continue
		}
		var directives []map[string]json.RawMessage
		if err := json.Unmarshal(raw, &directives); err != nil {
			continue
		}
		for _, directive := range directives {
			quit, ok := directive["quit"]
			if !ok {
				continue
			}
			var single string
			if err := json.Unmarshal(quit, &single); err == nil {
				ids = append(ids, single)
				continue
			}
			var many []string
			if err := json.Unmarshal(quit, &many); err == nil {
				ids = append(ids, many...)
			}
		}
	}
	return ids
}

func (c *catalogCask) displayName() string {
	if len(c.Name) > 0 && c.Name[0] != "" {
		return c.Name[0]
	}
	return c.Token
}

// catalogIndex maps lookup keys to casks for fast matching.
type catalogIndex struct {
	byApp      map[string][]*catalogCask
	byBundleID map[string][]*catalogCask
	byName     map[string][]*catalogCask
}

func newCatalogIndex(casks []catalogCask) *catalogIndex {
	idx := &catalogIndex{
		byApp:      map[string][]*catalogCask{},
		byBundleID: map[string][]*catalogCask{},
		byName:     map[string][]*catalogCask{},
	}
	for i := range casks {
		c := &casks[i]
		if c.Disabled {
			continue
		}
		apps := c.appArtifactNames()
		// Only casks that move an .app into the app directory can adopt one.
		if len(apps) == 0 {
			continue
		}
		for _, app := range apps {
			addUnique(idx.byApp, strings.ToLower(app), c)
			addUnique(idx.byName, normalizeAppName(strings.TrimSuffix(app, ".app")), c)
		}
		for _, id := range c.quitBundleIDs() {
			addUnique(idx.byBundleID, strings.ToLower(id), c)
		}
		for _, name := range c.Name {
			addUnique(idx.byName, normalizeAppName(name), c)
		}
		addUnique(idx.byName, normalizeAppName(c.Token), c)
	}
	return idx
}

func addUnique(m map[string][]*catalogCask, key string, c *catalogCask) {
	if key == "" {
		return
	}
	for _, existing := range m[key] {
		if existing == c {
			return
		}
	}
	m[key] = append(m[key], c)
}

var nonAlnum = regexp.MustCompile(`[^\p{L}\p{N}]+`)

func normalizeAppName(name string) string {
	return nonAlnum.ReplaceAllString(strings.ToLower(name), "")
}

var matchRank = map[string]int{AdoptMatchApp: 0, AdoptMatchBundleID: 1, AdoptMatchName: 2}

// candidatesFor returns the casks matching an installed app, best first.
func (idx *catalogIndex) candidatesFor(app installedApp) []AdoptCandidate {
	// Each stage only runs when the stronger ones found nothing, so a cask is
	// recorded with exactly one match kind.
	kinds := map[*catalogCask]string{}
	order := []*catalogCask{}
	record := func(casks []*catalogCask, kind string) {
		for _, c := range casks {
			if _, seen := kinds[c]; !seen {
				order = append(order, c)
				kinds[c] = kind
			}
		}
	}
	record(idx.byApp[strings.ToLower(app.FileName)], AdoptMatchApp)
	// Bundle IDs only help when the .app was renamed: quit stanzas also list
	// apps a cask merely closes (e.g. a converter quitting Chrome), so they
	// would add noise next to exact file-name matches.
	if len(order) == 0 && app.BundleID != "" {
		record(idx.byBundleID[strings.ToLower(app.BundleID)], AdoptMatchBundleID)
	}
	if len(order) == 0 {
		record(idx.byName[normalizeAppName(strings.TrimSuffix(app.FileName, ".app"))], AdoptMatchName)
	}

	candidates := make([]AdoptCandidate, 0, len(order))
	for _, c := range order {
		desc := ""
		if c.Desc != nil {
			desc = *c.Desc
		}
		candidates = append(candidates, AdoptCandidate{
			Token:         c.Token,
			FullToken:     c.FullToken,
			Name:          c.displayName(),
			Desc:          desc,
			Homepage:      c.Homepage,
			Version:       c.Version,
			AutoUpdates:   c.AutoUpdates != nil && *c.AutoUpdates,
			Deprecated:    c.Deprecated,
			MatchKind:     kinds[c],
			VersionStatus: compareAppVersion(app.Version, c.Version),
		})
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		a, b := candidates[i], candidates[j]
		if matchRank[a.MatchKind] != matchRank[b.MatchKind] {
			return matchRank[a.MatchKind] < matchRank[b.MatchKind]
		}
		if a.Deprecated != b.Deprecated {
			return !a.Deprecated
		}
		if (a.VersionStatus == AdoptVersionSame) != (b.VersionStatus == AdoptVersionSame) {
			return a.VersionStatus == AdoptVersionSame
		}
		// Prefer the main cask over variants like foo@beta or foo@nightly.
		aVariant, bVariant := strings.Contains(a.Token, "@"), strings.Contains(b.Token, "@")
		if aVariant != bVariant {
			return !aVariant
		}
		return a.Token < b.Token
	})
	return candidates
}

// adoptStatus classifies an app by its recommended (first) candidate.
func adoptStatus(best AdoptCandidate) string {
	if best.MatchKind == AdoptMatchName {
		return AdoptStatusUncertain
	}
	if best.AutoUpdates || best.VersionStatus == AdoptVersionSame {
		return AdoptStatusReady
	}
	return AdoptStatusVersionMismatch
}

var versionNumber = regexp.MustCompile(`\d+`)

// compareAppVersion relates an app's CFBundleShortVersionString to a cask
// version. Cask versions may carry build metadata after a comma
// ("2026.3,263.7307.200"), which is ignored.
func compareAppVersion(installed, caskVersion string) string {
	installed = strings.TrimPrefix(firstField(installed), "v")
	caskVersion = strings.TrimPrefix(firstField(strings.SplitN(caskVersion, ",", 2)[0]), "v")
	if installed == "" || caskVersion == "" || caskVersion == "latest" {
		return AdoptVersionUnknown
	}
	if strings.EqualFold(installed, caskVersion) {
		return AdoptVersionSame
	}
	a := versionNumber.FindAllString(installed, -1)
	b := versionNumber.FindAllString(caskVersion, -1)
	if len(a) == 0 || len(b) == 0 {
		return AdoptVersionUnknown
	}
	for i := 0; i < len(a) || i < len(b); i++ {
		x, y := segment(a, i), segment(b, i)
		if x < y {
			return AdoptVersionOlder
		}
		if x > y {
			return AdoptVersionNewer
		}
	}
	// Numerically equal but spelled differently (e.g. "1.0" vs "1.0.0" or a
	// pre-release suffix). Homebrew compares strings, so treat as unknown.
	return AdoptVersionUnknown
}

func firstField(s string) string {
	fields := strings.FieldsFunc(s, unicode.IsSpace)
	if len(fields) == 0 {
		return ""
	}
	return fields[0]
}

func segment(parts []string, i int) uint64 {
	if i >= len(parts) {
		return 0
	}
	n, err := strconv.ParseUint(parts[i], 10, 64)
	if err != nil {
		return 0
	}
	return n
}

// plistReader returns the top-level string values of a bundle's Info.plist.
type plistReader func(path string) (map[string]string, error)

// scanAppDir lists the .app bundles directly inside dir. Symlinks are skipped:
// they usually point into a Cellar or Caskroom and are already managed.
func scanAppDir(dir string, readPlist plistReader) ([]installedApp, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var bundles []os.DirEntry
	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasSuffix(entry.Name(), ".app") || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		bundles = append(bundles, entry)
	}

	apps := make([]installedApp, len(bundles))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)
	for i, entry := range bundles {
		wg.Add(1)
		go func(i int, name string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			path := filepath.Join(dir, name)
			app := installedApp{FileName: name, Path: path}
			if values, err := readPlist(filepath.Join(path, "Contents", "Info.plist")); err == nil {
				app.BundleID = values["CFBundleIdentifier"]
				app.Version = values["CFBundleShortVersionString"]
				if app.Version == "" {
					app.Version = values["CFBundleVersion"]
				}
			}
			if _, err := os.Stat(filepath.Join(path, "Contents", "_MASReceipt")); err == nil {
				app.AppStore = true
			}
			apps[i] = app
		}(i, entry.Name())
	}
	wg.Wait()
	return apps, nil
}

// buildAdoptResult classifies scanned apps against the catalog. managedApps
// holds lower-cased .app names already owned by installed casks.
func buildAdoptResult(appDir string, apps []installedApp, catalog []catalogCask, managedApps map[string]bool) *AdoptScanResult {
	idx := newCatalogIndex(catalog)
	result := &AdoptScanResult{
		AppDir:       appDir,
		Apps:         []AdoptableApp{},
		Unmatched:    []UnmatchedApp{},
		AppStoreApps: []string{},
	}

	for _, app := range apps {
		name := strings.TrimSuffix(app.FileName, ".app")
		switch {
		case managedApps[strings.ToLower(app.FileName)]:
			result.ManagedCount++
			continue
		case app.AppStore:
			result.AppStoreApps = append(result.AppStoreApps, name)
			continue
		case strings.HasPrefix(strings.ToLower(app.BundleID), "com.apple."):
			result.SystemCount++
			continue
		}

		candidates := idx.candidatesFor(app)
		if len(candidates) == 0 {
			result.Unmatched = append(result.Unmatched, UnmatchedApp{
				AppName: name, Path: app.Path, BundleID: app.BundleID, Version: app.Version,
			})
			continue
		}
		result.Apps = append(result.Apps, AdoptableApp{
			AppName:    name,
			Path:       app.Path,
			BundleID:   app.BundleID,
			Version:    app.Version,
			Status:     adoptStatus(candidates[0]),
			Candidates: candidates,
		})
	}

	sort.SliceStable(result.Apps, func(i, j int) bool {
		return strings.ToLower(result.Apps[i].AppName) < strings.ToLower(result.Apps[j].AppName)
	})
	sort.SliceStable(result.Unmatched, func(i, j int) bool {
		return strings.ToLower(result.Unmatched[i].AppName) < strings.ToLower(result.Unmatched[j].AppName)
	})
	return result
}

// managedAppNames returns the lower-cased .app names of all installed casks,
// read from `brew info --cask --json=v2 --installed` so casks from third-party
// taps (absent from the public catalog) are covered too.
func managedAppNames(executor commandRunner) (map[string]bool, error) {
	output, err := executor.RunNoCacheStdoutOnly("info", "--cask", "--json=v2", "--installed")
	if err != nil {
		return nil, fmt.Errorf("listing installed casks: %w", err)
	}
	var parsed struct {
		Casks []catalogCask `json:"casks"`
	}
	if err := json.Unmarshal(output, &parsed); err != nil {
		return nil, fmt.Errorf("parsing installed casks: %w", err)
	}
	managed := map[string]bool{}
	for i := range parsed.Casks {
		for _, app := range parsed.Casks[i].appArtifactNames() {
			managed[strings.ToLower(app)] = true
		}
	}
	return managed, nil
}
