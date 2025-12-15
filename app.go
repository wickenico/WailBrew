package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	rt "github.com/wailsapp/wails/v2/pkg/runtime"

	"WailBrew/backend/brew"
	"WailBrew/backend/config"
	"WailBrew/backend/logging"
	"WailBrew/backend/system"
)

var Version = "0.dev"

// Standard PATH and locale for brew commands
const brewEnvPath = "PATH=/opt/homebrew/sbin:/opt/homebrew/bin:/usr/local/sbin:/usr/local/bin:/usr/bin:/bin"
const brewEnvLang = "LANG=en_US.UTF-8"
const brewEnvLCAll = "LC_ALL=en_US.UTF-8"
const brewEnvNoAutoUpdate = "HOMEBREW_NO_AUTO_UPDATE=1"

// getMenuTranslations returns translations for the current language
func (a *App) getMenuTranslations() map[string]string {
	// Load translations if not already loaded
	if a.translations == nil {
		var err error
		a.translations, err = loadTranslations(a.currentLanguage)
		if err != nil {
			// Fallback to empty map on error
			a.translations = make(map[string]string)
		}
	}
	return a.translations
}

// GitHubRelease represents a GitHub release
type GitHubRelease struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	Body        string `json:"body"`
	PublishedAt string `json:"published_at"`
	Assets      []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
		Size               int64  `json:"size"`
	} `json:"assets"`
}

// UpdateInfo contains information about available updates
type UpdateInfo struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	ReleaseNotes   string `json:"releaseNotes"`
	DownloadURL    string `json:"downloadUrl"`
	FileSize       int64  `json:"fileSize"`
	PublishedAt    string `json:"publishedAt"`
}

// NewPackagesInfo contains information about newly discovered packages
type NewPackagesInfo struct {
	NewFormulae []string `json:"newFormulae"`
	NewCasks    []string `json:"newCasks"`
}

// Config represents the application configuration stored in ~/.wailbrew/config.json
// Config is imported from backend/config package
type Config = config.Config

// App struct
type App struct {
	ctx                context.Context
	brewPath           string
	currentLanguage    string
	translations       map[string]string // Cached translations for current language
	updateMutex        sync.Mutex
	lastUpdateTime     time.Time
	knownPackages      map[string]bool // Track all known packages to detect new ones
	knownPackagesMutex sync.Mutex
	config             *config.Config // Application configuration
	askpassManager     *system.Manager
	sessionLogManager  *logging.Manager
	brewExecutor       *brew.Executor
}

// detectBrewPath automatically detects the brew binary path
func detectBrewPath() string {
	// Common brew paths for different Mac architectures
	paths := []string{
		"/opt/homebrew/bin/brew",              // M1 Macs (Apple Silicon)
		"/usr/local/bin/brew",                 // Intel Macs
		"/home/linuxbrew/.linuxbrew/bin/brew", // Linux (if supported)
	}

	for _, path := range paths {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	// Fallback: try to find brew in PATH
	if path, err := exec.LookPath("brew"); err == nil {
		return path
	}

	// Last resort: default to M1 path
	return "/opt/homebrew/bin/brew"
}

// NewApp creates a new App application struct
func NewApp() *App {
	brewPath := detectBrewPath()
	app := &App{
		brewPath:          brewPath,
		currentLanguage:   "en",
		knownPackages:     make(map[string]bool),
		config:            &config.Config{},
		askpassManager:    system.NewManager(),
		sessionLogManager: logging.NewManager(),
	}

	// Initialize brew executor with basic env (will be updated after config loads)
	basicEnv := []string{
		brewEnvPath,
		brewEnvLang,
		brewEnvLCAll,
		brewEnvNoAutoUpdate,
	}
	app.brewExecutor = brew.NewExecutor(brewPath, basicEnv, app.sessionLogManager.Append)

	// Load initial translations
	var err error
	app.translations, err = loadTranslations("en")
	if err != nil {
		app.translations = make(map[string]string)
	}

	return app
}

// getAskpassPath returns the askpass helper path
func (a *App) getAskpassPath() string {
	if a.askpassManager != nil {
		return a.askpassManager.GetPath()
	}
	return ""
}

// getBrewEnv returns the standard brew environment variables including SUDO_ASKPASS
// SUDO_ASKPASS allows sudo to use our GUI password prompt instead of requiring terminal input
// When set, sudo will automatically call the askpass script when it needs a password
func (a *App) getBrewEnv() []string {
	env := []string{
		brewEnvPath,
		brewEnvLang,
		brewEnvLCAll,
		brewEnvNoAutoUpdate,
	}

	// Add SUDO_ASKPASS if askpass helper is available
	// This enables GUI password prompts for sudo operations during brew upgrades
	askpassPath := a.getAskpassPath()
	if askpassPath != "" {
		env = append(env, fmt.Sprintf("SUDO_ASKPASS=%s", askpassPath))
	}

	// Add mirror source environment variables if configured
	if a.config.GitRemote != "" {
		env = append(env, fmt.Sprintf("HOMEBREW_GIT_REMOTE=%s", a.config.GitRemote))
	}
	if a.config.BottleDomain != "" {
		env = append(env, fmt.Sprintf("HOMEBREW_BOTTLE_DOMAIN=%s", a.config.BottleDomain))
	}

	// Add HOMEBREW_CASK_OPTS if cask app directory is configured
	// Config value takes precedence over environment variable
	if a.config.CaskAppDir != "" {
		env = append(env, fmt.Sprintf("HOMEBREW_CASK_OPTS=--appdir=%s", a.config.CaskAppDir))
	}

	return env
}

// runBrewCommand executes a brew command and returns output and error
func (a *App) runBrewCommand(args ...string) ([]byte, error) {
	if a.brewExecutor != nil {
		return a.brewExecutor.Run(args...)
	}
	return nil, fmt.Errorf("brew executor not initialized")
}

// runBrewCommandWithTimeout executes a brew command with a timeout
func (a *App) runBrewCommandWithTimeout(timeout time.Duration, args ...string) ([]byte, error) {
	if a.brewExecutor != nil {
		return a.brewExecutor.RunWithTimeout(timeout, args...)
	}
	return nil, fmt.Errorf("brew executor not initialized")
}

// validateBrewInstallation checks if brew is working properly
func (a *App) validateBrewInstallation() error {
	if a.brewExecutor != nil {
		return a.brewExecutor.ValidateInstallation()
	}
	return fmt.Errorf("brew executor not initialized")
}

// startup saves the application context and sets up the askpass helper
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Load config from file
	if err := a.config.Load(); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to load config: %v\n", err)
	}

	// Update brew executor with full environment (including config-based env vars)
	if a.brewExecutor != nil {
		a.brewExecutor = brew.NewExecutor(a.brewPath, a.getBrewEnv(), a.sessionLogManager.Append)
	}

	// Set up the askpass helper for GUI sudo prompts
	if a.askpassManager != nil {
		if err := a.askpassManager.Setup(); err != nil {
			// Log error but don't fail startup - the app can still work without askpass
			fmt.Fprintf(os.Stderr, "Warning: failed to setup askpass helper: %v\n", err)
		}
	}

	// Reload translations for current language
	var err error
	a.translations, err = loadTranslations(a.currentLanguage)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to load translations: %v\n", err)
		a.translations = make(map[string]string)
	}
}

// shutdown cleans up resources when the application exits
func (a *App) shutdown(ctx context.Context) {
	if a.askpassManager != nil {
		a.askpassManager.Cleanup()
	}
	if a.sessionLogManager != nil {
		a.sessionLogManager.Clear()
	}
}

func (a *App) OpenURL(url string) {
	rt.BrowserOpenURL(a.ctx, url)
}

// SetLanguage updates the current language and rebuilds the menu
func (a *App) SetLanguage(language string) {
	a.currentLanguage = language
	// Reload translations for new language
	var err error
	a.translations, err = loadTranslations(language)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to load translations for %s: %v\n", language, err)
		a.translations = make(map[string]string)
	}
	// Rebuild the menu with new language
	newMenu := a.menu()
	rt.MenuSetApplicationMenu(a.ctx, newMenu)
}

// GetCurrentLanguage returns the current language
func (a *App) GetCurrentLanguage() string {
	return a.currentLanguage
}

// appendSessionLog adds a log entry to the session log buffer
func (a *App) appendSessionLog(entry string) {
	if a.sessionLogManager != nil {
		a.sessionLogManager.Append(entry)
	}
}

// GetSessionLogs returns all session logs as a string
func (a *App) GetSessionLogs() string {
	if a.sessionLogManager != nil {
		return a.sessionLogManager.Get()
	}
	return ""
}

// extractJSONFromBrewOutput is now in backend/brew package
var extractJSONFromBrewOutput = brew.ExtractJSONFromOutput

// parseBrewWarnings is now in backend/brew package
var parseBrewWarnings = brew.ParseWarnings

// getBackendMessage returns a translated backend message using i18n loader
func (a *App) getBackendMessage(key string, params map[string]string) string {
	// Load translations if not already loaded
	if a.translations == nil {
		var err error
		a.translations, err = loadTranslations(a.currentLanguage)
		if err != nil {
			return key // Return key if translation loading fails
		}
	}

	// Map old keys to new backend.* keys
	keyMap := map[string]string{
		"updateStart":               "backend.update.start",
		"updateSuccess":             "backend.update.success",
		"updateFailed":              "backend.update.failed",
		"updateAllStart":            "backend.updateAll.start",
		"updateAllSuccess":          "backend.updateAll.success",
		"updateAllFailed":           "backend.updateAll.failed",
		"updateRetryingWithForce":   "backend.update.retryingWithForce",
		"updateRetryingFailedCasks": "backend.update.retryingFailedCasks",
		"installStart":              "backend.install.start",
		"installSuccess":            "backend.install.success",
		"installFailed":             "backend.install.failed",
		"uninstallStart":            "backend.uninstall.start",
		"uninstallSuccess":          "backend.uninstall.success",
		"uninstallFailed":           "backend.uninstall.failed",
		"errorCreatingPipe":         "backend.errors.creatingPipe",
		"errorCreatingErrorPipe":    "backend.errors.creatingErrorPipe",
		"errorStartingUpdate":       "backend.errors.startingUpdate",
		"errorStartingUpdateAll":    "backend.errors.startingUpdateAll",
		"errorStartingInstall":      "backend.errors.startingInstall",
		"errorStartingUninstall":    "backend.errors.startingUninstall",
		"untapStart":                "backend.untap.start",
		"untapSuccess":              "backend.untap.success",
		"untapFailed":               "backend.untap.failed",
		"errorStartingUntap":        "backend.errors.startingUntap",
		"tapStart":                  "backend.tap.start",
		"tapSuccess":                "backend.tap.success",
		"tapFailed":                 "backend.tap.failed",
		"errorStartingTap":          "backend.errors.startingTap",
	}

	// Convert old key to new key format
	newKey, exists := keyMap[key]
	if !exists {
		newKey = "backend." + key // Fallback: try backend.* format
	}

	return getTranslation(a.translations, newKey, params)
}

func (a *App) menu() *menu.Menu {
	translations := a.getMenuTranslations()
	getT := func(key string) string {
		return getTranslation(translations, key, nil)
	}

	AppMenu := menu.NewMenu()

	// App Menü (macOS-like)
	AppSubmenu := AppMenu.AddSubmenu("WailBrew")
	AppSubmenu.AddText(getT("menu.app.about"), nil, func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "showAbout")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(getT("menu.view.settings"), keys.CmdOrCtrl(","), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "settings")
	})
	AppSubmenu.AddText(getT("menu.view.commandPalette"), keys.CmdOrCtrl("k"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "showCommandPalette")
	})
	AppSubmenu.AddText(getT("menu.view.shortcuts"), keys.Combo("s", keys.CmdOrCtrlKey, keys.ShiftKey), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "showShortcuts")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(getT("menu.app.checkUpdates"), nil, func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "checkForUpdates")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(getT("menu.app.visitWebsite"), nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://wailbrew.app")
	})
	AppSubmenu.AddText(getT("menu.app.visitGitHub"), nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://github.com/wickenico/WailBrew")
	})
	AppSubmenu.AddText(getT("menu.app.reportBug"), nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://github.com/wickenico/WailBrew/issues")
	})
	AppSubmenu.AddText(getT("menu.app.visitSubreddit"), nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://www.reddit.com/r/WailBrew/")
	})
	AppSubmenu.AddText(getT("menu.app.sponsorProject"), nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://github.com/sponsors/wickenico")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(getT("menu.app.quit"), keys.CmdOrCtrl("q"), func(cd *menu.CallbackData) {
		rt.Quit(a.ctx)
	})

	ViewMenu := AppMenu.AddSubmenu(getT("menu.view.title"))
	ViewMenu.AddText(getT("menu.view.installed"), keys.CmdOrCtrl("1"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "installed")
	})
	ViewMenu.AddText(getT("menu.view.casks"), keys.CmdOrCtrl("2"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "casks")
	})
	ViewMenu.AddText(getT("menu.view.outdated"), keys.CmdOrCtrl("3"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "updatable")
	})
	ViewMenu.AddText(getT("menu.view.all"), keys.CmdOrCtrl("4"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "all")
	})
	ViewMenu.AddText(getT("menu.view.leaves"), keys.CmdOrCtrl("5"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "leaves")
	})
	ViewMenu.AddText(getT("menu.view.repositories"), keys.CmdOrCtrl("6"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "repositories")
	})
	ViewMenu.AddSeparator()
	ViewMenu.AddText(getT("menu.view.homebrew"), keys.CmdOrCtrl("7"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "homebrew")
	})
	ViewMenu.AddText(getT("menu.view.doctor"), keys.CmdOrCtrl("8"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "doctor")
	})
	ViewMenu.AddText(getT("menu.view.cleanup"), keys.CmdOrCtrl("9"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "cleanup")
	})

	// Tools Menu
	ToolsMenu := AppMenu.AddSubmenu(getT("menu.tools.title"))
	ToolsMenu.AddText(getT("menu.tools.refreshPackages"), keys.Combo("r", keys.CmdOrCtrlKey, keys.ShiftKey), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "refreshPackagesData")
	})
	ToolsMenu.AddSeparator()
	ToolsMenu.AddText(getT("menu.tools.exportBrewfile"), keys.CmdOrCtrl("e"), func(cd *menu.CallbackData) {
		// Open file picker dialog to save Brewfile
		saveDialog, err := rt.SaveFileDialog(a.ctx, rt.SaveDialogOptions{
			DefaultFilename:      "Brewfile",
			Title:                getT("menu.tools.exportBrewfile"),
			CanCreateDirectories: true,
		})

		if err == nil && saveDialog != "" {
			err := a.ExportBrewfile(saveDialog)
			if err != nil {
				rt.MessageDialog(a.ctx, rt.MessageDialogOptions{
					Type:    rt.ErrorDialog,
					Title:   getT("menu.tools.exportFailed"),
					Message: fmt.Sprintf("Failed to export Brewfile: %v", err),
				})
			} else {
				rt.MessageDialog(a.ctx, rt.MessageDialogOptions{
					Type:    rt.InfoDialog,
					Title:   getT("menu.tools.exportSuccess"),
					Message: fmt.Sprintf(getT("menu.tools.exportMessage"), saveDialog),
				})
			}
		}
	})
	ToolsMenu.AddSeparator()
	ToolsMenu.AddText(getT("menu.tools.viewSessionLogs"), nil, func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "showSessionLogs")
	})

	// Edit-Menü (optional)
	if runtime.GOOS == "darwin" {
		AppMenu.Append(menu.EditMenu())
		AppMenu.Append(menu.WindowMenu())
	}

	HelpMenu := AppMenu.AddSubmenu(getT("menu.help.title"))
	HelpMenu.AddText(getT("menu.help.wailbrewHelp"), nil, func(cd *menu.CallbackData) {
		rt.MessageDialog(a.ctx, rt.MessageDialogOptions{
			Type:    rt.InfoDialog,
			Title:   getT("menu.help.helpTitle"),
			Message: getT("menu.help.helpMessage"),
		})
	})

	return AppMenu
}

func (a *App) GetAllBrewPackages() [][]string {
	output, err := a.runBrewCommand("formulae")
	if err != nil {
		// On error, return a helpful message instead of crashing
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch all packages: %v. This often happens on fresh Homebrew installations. Try refreshing after a few minutes.", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var results [][]string

	// Initialize known packages on first call
	a.knownPackagesMutex.Lock()
	if len(a.knownPackages) == 0 {
		// First time - initialize with current packages
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line != "" {
				a.knownPackages["formula:"+line] = true
			}
		}
		// Also add casks
		caskOutput, err := a.runBrewCommand("casks")
		if err == nil {
			caskLines := strings.Split(strings.TrimSpace(string(caskOutput)), "\n")
			for _, line := range caskLines {
				line = strings.TrimSpace(line)
				if line != "" {
					a.knownPackages["cask:"+line] = true
				}
			}
		}
	}
	a.knownPackagesMutex.Unlock()

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			// For all packages (not installed), we don't have version or size yet
			results = append(results, []string{line, "", ""})
		}
	}

	return results
}

// GetBrewPackages retrieves the list of installed Homebrew packages with size information
func (a *App) GetBrewPackages() [][]string {
	// Validate brew installation first
	if err := a.validateBrewInstallation(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	output, err := a.runBrewCommand("list", "--formula", "--versions")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch installed packages: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		// No packages installed, return empty list instead of error
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var packageNames []string
	packageVersions := make(map[string]string)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) >= 2 {
			packageNames = append(packageNames, parts[0])
			packageVersions[parts[0]] = parts[1]
		} else if len(parts) == 1 {
			packageNames = append(packageNames, parts[0])
			packageVersions[parts[0]] = "Unknown"
		}
	}

	// Build result with name, version, and empty size (lazy loaded)
	var packages [][]string
	for _, name := range packageNames {
		version := packageVersions[name]
		packages = append(packages, []string{name, version, ""})
	}

	return packages
}

// getPackageSizes fetches size information for packages with chunking support
func (a *App) getPackageSizes(packageNames []string, isCask bool) map[string]string {
	sizes := make(map[string]string)

	if len(packageNames) == 0 {
		return sizes
	}

	// Chunk size: process packages in batches to avoid command line length limits
	// and improve reliability with large package lists
	const chunkSize = 50

	for i := 0; i < len(packageNames); i += chunkSize {
		end := i + chunkSize
		if end > len(packageNames) {
			end = len(packageNames)
		}
		chunk := packageNames[i:end]

		// Build brew info command for this chunk
		args := []string{"info", "--json=v2"}
		if isCask {
			args = append(args, "--cask")
		}
		args = append(args, chunk...)

		output, err := a.runBrewCommand(args...)
		if err != nil {
			// If chunk fails, mark these packages as unknown and continue
			for _, name := range chunk {
				sizes[name] = "Unknown"
			}
			continue
		}

		// Extract JSON portion from output (handling potential Homebrew warnings)
		outputStr := strings.TrimSpace(string(output))
		jsonOutput, warnings, err := extractJSONFromBrewOutput(outputStr)
		if err != nil {
			// If JSON extraction fails, mark chunk as unknown and continue
			for _, name := range chunk {
				sizes[name] = "Unknown"
			}
			continue
		}

		// Log warnings if any were detected
		if warnings != "" {
			a.appendSessionLog(fmt.Sprintf("Homebrew warnings in package sizes: %s", warnings))
		}

		// Parse JSON response
		var brewInfo struct {
			Formulae []struct {
				Name      string `json:"name"`
				Installed []struct {
					InstalledOnDemand bool  `json:"installed_on_demand"`
					UsedOptions       []any `json:"used_options"`
					BuiltAsBottle     bool  `json:"built_as_bottle"`
					Poured            bool  `json:"poured_from_bottle"`
					Time              int64 `json:"time"`
					RuntimeDeps       []any `json:"runtime_dependencies"`
					InstalledAsDep    bool  `json:"installed_as_dependency"`
					InstalledWithOpts []any `json:"installed_with_options"`
				} `json:"installed"`
			} `json:"formulae"`
			Casks []struct {
				Token     string `json:"token"`
				Installed string `json:"installed"`
			} `json:"casks"`
		}

		if err := json.Unmarshal([]byte(jsonOutput), &brewInfo); err != nil {
			// If JSON parsing fails, mark chunk as unknown and continue
			for _, name := range chunk {
				sizes[name] = "Unknown"
			}
			continue
		}

		// For formulae, calculate size from cellar
		if !isCask {
			for _, formula := range brewInfo.Formulae {
				size := a.calculateFormulaSize(formula.Name)
				sizes[formula.Name] = size
			}
		} else {
			// For casks, calculate size from caskroom
			for _, cask := range brewInfo.Casks {
				size := a.calculateCaskSize(cask.Token)
				sizes[cask.Token] = size
			}
		}
	}

	// Fill in any missing sizes
	for _, name := range packageNames {
		if _, exists := sizes[name]; !exists {
			sizes[name] = "Unknown"
		}
	}

	return sizes
}

// GetBrewPackageSizes fetches size information for a list of package names
// This is called separately after initial package load for lazy loading
func (a *App) GetBrewPackageSizes(packageNames []string) map[string]string {
	return a.getPackageSizes(packageNames, false)
}

// GetBrewCaskSizes fetches size information for a list of cask names
// This is called separately after initial cask load for lazy loading
func (a *App) GetBrewCaskSizes(caskNames []string) map[string]string {
	return a.getPackageSizes(caskNames, true)
}

// calculateFormulaSize calculates the disk size of an installed formula
func (a *App) calculateFormulaSize(formulaName string) string {
	// Get formula path in cellar
	cellarPath := ""
	if runtime.GOOS == "darwin" {
		if runtime.GOARCH == "arm64" {
			cellarPath = fmt.Sprintf("/opt/homebrew/Cellar/%s", formulaName)
		} else {
			cellarPath = fmt.Sprintf("/usr/local/Cellar/%s", formulaName)
		}
	}

	// Use du command to get directory size
	cmd := exec.Command("du", "-sh", cellarPath)
	output, err := cmd.Output()
	if err != nil {
		return "Unknown"
	}

	// Parse du output (format: "SIZE	PATH")
	parts := strings.Fields(string(output))
	if len(parts) >= 1 {
		return parts[0]
	}

	return "Unknown"
}

// calculateCaskSize calculates the disk size of an installed cask
func (a *App) calculateCaskSize(caskName string) string {
	// Get cask path in caskroom
	caskroomPath := ""
	if runtime.GOOS == "darwin" {
		if runtime.GOARCH == "arm64" {
			caskroomPath = fmt.Sprintf("/opt/homebrew/Caskroom/%s", caskName)
		} else {
			caskroomPath = fmt.Sprintf("/usr/local/Caskroom/%s", caskName)
		}
	}

	// Use du command to get directory size
	cmd := exec.Command("du", "-sh", caskroomPath)
	output, err := cmd.Output()
	if err != nil {
		return "Unknown"
	}

	// Parse du output (format: "SIZE	PATH")
	parts := strings.Fields(string(output))
	if len(parts) >= 1 {
		return parts[0]
	}

	return "Unknown"
}

// GetBrewCasks retrieves the list of installed Homebrew casks
func (a *App) GetBrewCasks() [][]string {
	// Validate brew installation first
	if err := a.validateBrewInstallation(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	// Get list of cask names only (more reliable than --versions)
	output, err := a.runBrewCommand("list", "--cask")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch installed casks: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		// No casks installed, return empty list instead of error
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var caskNames []string
	for _, line := range lines {
		caskName := strings.TrimSpace(line)
		if caskName != "" {
			caskNames = append(caskNames, caskName)
		}
	}

	if len(caskNames) == 0 {
		return [][]string{}
	}

	var casks [][]string
	versionMap := make(map[string]string)

	// Try to get all cask info at once first
	args := []string{"info", "--cask", "--json=v2"}
	args = append(args, caskNames...)

	infoOutput, err := a.runBrewCommand(args...)
	if err == nil {
		// Parse JSON to get versions
		var caskInfo struct {
			Casks []struct {
				Token   string `json:"token"`
				Version string `json:"version"`
			} `json:"casks"`
		}

		if err := json.Unmarshal(infoOutput, &caskInfo); err == nil {
			// Create a map for easy lookup
			for _, cask := range caskInfo.Casks {
				version := cask.Version
				if version == "" {
					version = "Unknown"
				}
				versionMap[cask.Token] = version
			}
		}
	}

	// If batch fetch fails, try individually
	if len(versionMap) == 0 {
		for _, caskName := range caskNames {
			infoOutput, err := a.runBrewCommand("info", "--cask", "--json=v2", caskName)
			if err != nil {
				versionMap[caskName] = "Unknown"
				continue
			}

			var caskInfo struct {
				Casks []struct {
					Version string `json:"version"`
				} `json:"casks"`
			}

			if err := json.Unmarshal(infoOutput, &caskInfo); err == nil && len(caskInfo.Casks) > 0 {
				version := caskInfo.Casks[0].Version
				if version == "" {
					version = "Unknown"
				}
				versionMap[caskName] = version
			} else {
				versionMap[caskName] = "Unknown"
			}
		}
	}

	// Build result array with name, version, and empty size (lazy loaded)
	for _, name := range caskNames {
		version := versionMap[name]
		if version == "" {
			version = "Unknown"
		}
		casks = append(casks, []string{name, version, ""})
	}

	return casks
}

// UpdateBrewDatabase updates the Homebrew formula database
// It uses a mutex to ensure only one update runs at a time and caches the result
// for 5 minutes to avoid redundant updates
func (a *App) UpdateBrewDatabase() error {
	a.updateMutex.Lock()
	defer a.updateMutex.Unlock()

	// If we updated less than 5 minutes ago, skip the update
	if time.Since(a.lastUpdateTime) < 5*time.Minute {
		return nil
	}

	// Run brew update to refresh the local formula database
	_, err := a.runBrewCommandWithTimeout(60*time.Second, "update")

	// Update the timestamp even if there was an error, to avoid hammering
	// the update command if there's a persistent issue
	a.lastUpdateTime = time.Now()

	return err
}

// UpdateBrewDatabaseWithOutput updates the Homebrew formula database and returns the output
// This version captures the output to detect new packages
func (a *App) UpdateBrewDatabaseWithOutput() (string, error) {
	a.updateMutex.Lock()
	defer a.updateMutex.Unlock()

	// If we updated less than 5 minutes ago, skip the update
	if time.Since(a.lastUpdateTime) < 5*time.Minute {
		return "", nil
	}

	// Run brew update to refresh the local formula database
	output, err := a.runBrewCommandWithTimeout(60*time.Second, "update")

	// Update the timestamp even if there was an error, to avoid hammering
	// the update command if there's a persistent issue
	a.lastUpdateTime = time.Now()

	return string(output), err
}

// ParseNewPackagesFromUpdateOutput parses brew update output to extract new formulae and casks
func (a *App) ParseNewPackagesFromUpdateOutput(output string) *NewPackagesInfo {
	info := &NewPackagesInfo{
		NewFormulae: []string{},
		NewCasks:    []string{},
	}

	if output == "" {
		return info
	}

	lines := strings.Split(output, "\n")
	inNewFormulae := false
	inNewCasks := false

	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Detect section headers
		if strings.Contains(line, "==> New Formulae") {
			inNewFormulae = true
			inNewCasks = false
			continue
		}
		if strings.Contains(line, "==> New Casks") {
			inNewFormulae = false
			inNewCasks = true
			continue
		}
		// Stop when we hit another section
		if strings.HasPrefix(line, "==>") {
			inNewFormulae = false
			inNewCasks = false
			continue
		}

		// Parse package names (format: "package-name: Description")
		if inNewFormulae || inNewCasks {
			// Extract package name (everything before the colon)
			parts := strings.SplitN(line, ":", 2)
			if len(parts) > 0 {
				packageName := strings.TrimSpace(parts[0])
				if packageName != "" {
					if inNewFormulae {
						info.NewFormulae = append(info.NewFormulae, packageName)
					} else if inNewCasks {
						info.NewCasks = append(info.NewCasks, packageName)
					}
				}
			}
		}
	}

	return info
}

// CheckForNewPackages checks for new packages and returns information about newly discovered ones
func (a *App) CheckForNewPackages() (*NewPackagesInfo, error) {
	// Get current list of all packages
	allFormulae, err := a.runBrewCommand("formulae")
	if err != nil {
		return nil, fmt.Errorf("failed to get formulae list: %w", err)
	}

	allCasks, err := a.runBrewCommand("casks")
	if err != nil {
		return nil, fmt.Errorf("failed to get casks list: %w", err)
	}

	// Parse current packages
	currentPackages := make(map[string]bool)

	formulaeLines := strings.Split(strings.TrimSpace(string(allFormulae)), "\n")
	for _, line := range formulaeLines {
		name := strings.TrimSpace(line)
		if name != "" {
			currentPackages["formula:"+name] = true
		}
	}

	caskLines := strings.Split(strings.TrimSpace(string(allCasks)), "\n")
	for _, line := range caskLines {
		name := strings.TrimSpace(line)
		if name != "" {
			currentPackages["cask:"+name] = true
		}
	}

	// Compare with known packages
	a.knownPackagesMutex.Lock()
	defer a.knownPackagesMutex.Unlock()

	newInfo := &NewPackagesInfo{
		NewFormulae: []string{},
		NewCasks:    []string{},
	}

	// If knownPackages is empty, this is the first call - initialize it
	// and don't report all packages as "new"
	if len(a.knownPackages) == 0 {
		a.knownPackages = currentPackages
		return newInfo, nil
	}

	// Find new packages
	for pkg := range currentPackages {
		if !a.knownPackages[pkg] {
			// This is a new package
			if strings.HasPrefix(pkg, "formula:") {
				newInfo.NewFormulae = append(newInfo.NewFormulae, strings.TrimPrefix(pkg, "formula:"))
			} else if strings.HasPrefix(pkg, "cask:") {
				newInfo.NewCasks = append(newInfo.NewCasks, strings.TrimPrefix(pkg, "cask:"))
			}
		}
	}

	// Update known packages
	a.knownPackages = currentPackages

	return newInfo, nil
}

// GetBrewUpdatablePackages checks which packages have updates available using brew outdated
func (a *App) GetBrewUpdatablePackages() [][]string {
	// Validate brew installation first
	if err := a.validateBrewInstallation(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	// Update the formula database first to get latest information
	// Ignore errors from update - we'll still try to get outdated packages
	updateOutput, err := a.UpdateBrewDatabaseWithOutput()
	var newPackages *NewPackagesInfo
	var shouldEmitEvent bool

	if err == nil && updateOutput != "" {
		// Try to detect new packages from update output
		newPackages = a.ParseNewPackagesFromUpdateOutput(updateOutput)
		if len(newPackages.NewFormulae) > 0 || len(newPackages.NewCasks) > 0 {
			// Update knownPackages to prevent duplicate notifications
			a.knownPackagesMutex.Lock()
			for _, formula := range newPackages.NewFormulae {
				a.knownPackages["formula:"+formula] = true
			}
			for _, cask := range newPackages.NewCasks {
				a.knownPackages["cask:"+cask] = true
			}
			a.knownPackagesMutex.Unlock()
			shouldEmitEvent = true
		}
	} else {
		// Fallback: try to detect new packages by comparing current list
		detectedPackages, err := a.CheckForNewPackages()
		if err == nil && (len(detectedPackages.NewFormulae) > 0 || len(detectedPackages.NewCasks) > 0) {
			newPackages = detectedPackages
			shouldEmitEvent = true
		}
	}

	// Emit event only once if new packages were discovered
	if shouldEmitEvent && newPackages != nil && a.ctx != nil {
		eventData := map[string]interface{}{
			"newFormulae": newPackages.NewFormulae,
			"newCasks":    newPackages.NewCasks,
		}
		jsonData, _ := json.Marshal(eventData)
		rt.EventsEmit(a.ctx, "newPackagesDiscovered", string(jsonData))
	}

	// Use brew outdated with JSON output for accurate detection
	// Use the configured outdated flag setting
	outdatedFlag := a.GetOutdatedFlag()
	args := []string{"outdated", "--json=v2"}
	if outdatedFlag == "greedy" {
		args = append(args, "--greedy")
	} else if outdatedFlag == "greedy-auto-updates" {
		args = append(args, "--greedy-auto-updates")
	}
	// If outdatedFlag is "none", no additional flag is added
	output, err := a.runBrewCommand(args...)
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to check for updates: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	// If output is empty or "[]", no packages are outdated
	if outputStr == "" || outputStr == "[]" {
		return [][]string{}
	}

	// Extract JSON portion from output (in case there are warnings before the JSON)
	jsonOutput, warnings, err := extractJSONFromBrewOutput(outputStr)
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to extract JSON from brew outdated output: %v", err)}}
	}

	// Parse warnings to map them to specific packages
	warningMap := parseBrewWarnings(warnings)

	// Log warnings if any were detected
	if warnings != "" {
		a.appendSessionLog(fmt.Sprintf("Homebrew warnings detected:\n%s", warnings))
	}

	// Parse JSON response from brew outdated
	var brewOutdated struct {
		Formulae []struct {
			Name              string   `json:"name"`
			InstalledVersions []string `json:"installed_versions"`
			CurrentVersion    string   `json:"current_version"`
			Pinned            bool     `json:"pinned"`
			PinnedVersion     string   `json:"pinned_version"`
		} `json:"formulae"`
		Casks []struct {
			Name              string   `json:"name"`
			InstalledVersions []string `json:"installed_versions"`
			CurrentVersion    string   `json:"current_version"`
		} `json:"casks"`
	}

	if err := json.Unmarshal([]byte(jsonOutput), &brewOutdated); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to parse outdated packages: %v", err)}}
	}

	var updatablePackages [][]string
	var formulaeNames []string
	var caskNames []string

	// Process formulae (packages)
	for _, formula := range brewOutdated.Formulae {
		// Skip pinned packages as they won't be updated
		if formula.Pinned {
			continue
		}

		installedVersion := "unknown"
		if len(formula.InstalledVersions) > 0 {
			installedVersion = formula.InstalledVersions[0]
		}

		formulaeNames = append(formulaeNames, formula.Name)

		// Get warning for this package if any
		warning := ""
		if w, found := warningMap[formula.Name]; found {
			warning = w
		}

		updatablePackages = append(updatablePackages, []string{
			formula.Name,
			installedVersion,
			formula.CurrentVersion,
			"",      // size placeholder, will be filled below
			warning, // warning message
		})
	}

	// Process casks (applications)
	for _, cask := range brewOutdated.Casks {
		installedVersion := "unknown"
		if len(cask.InstalledVersions) > 0 {
			installedVersion = cask.InstalledVersions[0]
		}

		caskNames = append(caskNames, cask.Name)

		// Get warning for this cask if any
		warning := ""
		if w, found := warningMap[cask.Name]; found {
			warning = w
		}

		updatablePackages = append(updatablePackages, []string{
			cask.Name,
			installedVersion,
			cask.CurrentVersion,
			"",      // size placeholder, will be filled below
			warning, // warning message
		})
	}

	// Get size information for all packages
	formulaeSizes := a.getPackageSizes(formulaeNames, false)
	caskSizes := a.getPackageSizes(caskNames, true)

	// Fill in size information
	for i := range updatablePackages {
		name := updatablePackages[i][0]
		if size, found := formulaeSizes[name]; found {
			updatablePackages[i][3] = size
		} else if size, found := caskSizes[name]; found {
			updatablePackages[i][3] = size
		} else {
			updatablePackages[i][3] = "Unknown"
		}
	}

	return updatablePackages
}

func (a *App) GetBrewLeaves() []string {
	output, err := a.runBrewCommand("leaves")
	if err != nil {
		return []string{fmt.Sprintf("Error: %v", err)}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return []string{}
	}

	lines := strings.Split(outputStr, "\n")
	var results []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			results = append(results, line)
		}
	}

	return results
}

func (a *App) GetBrewTaps() [][]string {
	output, err := a.runBrewCommand("tap")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch repositories: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var taps [][]string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			taps = append(taps, []string{line, "Active"})
		}
	}

	return taps
}

// UntapBrewRepository untaps a repository with live progress updates
func (a *App) UntapBrewRepository(repositoryName string) string {
	// Emit initial progress
	startMessage := a.getBackendMessage("untapStart", map[string]string{"name": repositoryName})
	rt.EventsEmit(a.ctx, "repositoryUntapProgress", startMessage)

	cmd := exec.Command(a.brewPath, "untap", repositoryName)
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "repositoryUntapProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "repositoryUntapProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := a.getBackendMessage("errorStartingUntap", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "repositoryUntapProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "repositoryUntapProgress", fmt.Sprintf("🗑️ %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "repositoryUntapProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()
	if err != nil {
		errorMsg := a.getBackendMessage("untapFailed", map[string]string{"name": repositoryName, "error": err.Error()})
		rt.EventsEmit(a.ctx, "repositoryUntapProgress", errorMsg)
		rt.EventsEmit(a.ctx, "repositoryUntapComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := a.getBackendMessage("untapSuccess", map[string]string{"name": repositoryName})
	rt.EventsEmit(a.ctx, "repositoryUntapProgress", successMsg)
	rt.EventsEmit(a.ctx, "repositoryUntapComplete", successMsg)
	return successMsg
}

// TapBrewRepository taps a repository with live progress updates
func (a *App) TapBrewRepository(repositoryName string) string {
	// Emit initial progress
	startMessage := a.getBackendMessage("tapStart", map[string]string{"name": repositoryName})
	rt.EventsEmit(a.ctx, "repositoryTapProgress", startMessage)

	cmd := exec.Command(a.brewPath, "tap", repositoryName)
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "repositoryTapProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "repositoryTapProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := a.getBackendMessage("errorStartingTap", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "repositoryTapProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "repositoryTapProgress", fmt.Sprintf("📦 %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "repositoryTapProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()
	if err != nil {
		errorMsg := a.getBackendMessage("tapFailed", map[string]string{"name": repositoryName, "error": err.Error()})
		rt.EventsEmit(a.ctx, "repositoryTapProgress", errorMsg)
		rt.EventsEmit(a.ctx, "repositoryTapComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := a.getBackendMessage("tapSuccess", map[string]string{"name": repositoryName})
	rt.EventsEmit(a.ctx, "repositoryTapProgress", successMsg)
	rt.EventsEmit(a.ctx, "repositoryTapComplete", successMsg)
	return successMsg
}

// GetBrewTapInfo retrieves information about a tapped repository
func (a *App) GetBrewTapInfo(repositoryName string) string {
	output, err := a.runBrewCommand("tap-info", repositoryName)
	if err != nil {
		return fmt.Sprintf("Error: Failed to get tap info: %v", err)
	}

	return string(output)
}

// RemoveBrewPackage uninstalls a package with live progress updates
func (a *App) RemoveBrewPackage(packageName string) string {
	// Emit initial progress
	startMessage := a.getBackendMessage("uninstallStart", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageUninstallProgress", startMessage)

	cmd := exec.Command(a.brewPath, "uninstall", packageName)
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUninstallProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUninstallProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := a.getBackendMessage("errorStartingUninstall", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUninstallProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUninstallProgress", fmt.Sprintf("🗑️ %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUninstallProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()
	if err != nil {
		errorMsg := a.getBackendMessage("uninstallFailed", map[string]string{"name": packageName, "error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUninstallProgress", errorMsg)
		rt.EventsEmit(a.ctx, "packageUninstallComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := a.getBackendMessage("uninstallSuccess", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageUninstallProgress", successMsg)
	rt.EventsEmit(a.ctx, "packageUninstallComplete", successMsg)
	return successMsg
}

// InstallBrewPackage installs a package with live progress updates
func (a *App) InstallBrewPackage(packageName string) string {
	// Emit initial progress
	startMessage := a.getBackendMessage("installStart", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageInstallProgress", startMessage)

	cmd := exec.Command(a.brewPath, "install", packageName)
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageInstallProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageInstallProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := a.getBackendMessage("errorStartingInstall", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageInstallProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageInstallProgress", fmt.Sprintf("📦 %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageInstallProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()
	if err != nil {
		errorMsg := a.getBackendMessage("installFailed", map[string]string{"name": packageName, "error": err.Error()})
		rt.EventsEmit(a.ctx, "packageInstallProgress", errorMsg)
		rt.EventsEmit(a.ctx, "packageInstallComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := a.getBackendMessage("installSuccess", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageInstallProgress", successMsg)
	rt.EventsEmit(a.ctx, "packageInstallComplete", successMsg)
	return successMsg
}

// isPackageCask checks if a package is a cask
func (a *App) isPackageCask(packageName string) bool {
	output, err := a.runBrewCommand("info", "--json=v2", packageName)
	if err != nil {
		return false
	}

	outputStr := strings.TrimSpace(string(output))
	jsonOutput, _, err := extractJSONFromBrewOutput(outputStr)
	if err != nil {
		return false
	}

	var result struct {
		Formulae []map[string]interface{} `json:"formulae"`
		Casks    []map[string]interface{} `json:"casks"`
	}
	if err := json.Unmarshal([]byte(jsonOutput), &result); err != nil {
		return false
	}

	// If found in casks but not in formulae, it's a cask
	return len(result.Casks) > 0 && len(result.Formulae) == 0
}

// isAppAlreadyExistsError checks if the error is the "app already exists" error
func (a *App) isAppAlreadyExistsError(stderrOutput string) bool {
	return strings.Contains(stderrOutput, "It seems there is already an app at") ||
		strings.Contains(stderrOutput, "already an App at")
}

// extractFailedPackagesFromError extracts package names from "app already exists" errors
func (a *App) extractFailedPackagesFromError(stderrOutput string) []string {
	var failedPackages []string
	lines := strings.Split(stderrOutput, "\n")
	for _, line := range lines {
		// Error format: "Error: package-name: It seems there is already an app at..."
		if strings.Contains(line, "It seems there is already an app at") ||
			strings.Contains(line, "already an App at") {
			// Try to extract package name
			// Format is typically: "Error: package-name: It seems..."
			parts := strings.Split(line, ":")
			if len(parts) >= 3 {
				// Format: "Error" : "package-name" : "It seems..."
				pkgName := strings.TrimSpace(parts[1])
				if pkgName != "" {
					failedPackages = append(failedPackages, pkgName)
				}
			} else if len(parts) >= 2 {
				// Fallback: "package-name: It seems..."
				pkgName := strings.TrimSpace(parts[0])
				if pkgName != "" && !strings.Contains(pkgName, "Error") {
					failedPackages = append(failedPackages, pkgName)
				}
			}
		}
	}
	return failedPackages
}

// UpdateBrewPackage upgrades a package with live progress updates
func (a *App) UpdateBrewPackage(packageName string) string {
	// Emit initial progress
	startMessage := a.getBackendMessage("updateStart", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageUpdateProgress", startMessage)

	// Try normal upgrade first
	finalMessage, wailbrewUpdated, shouldRetry := a.runUpdateCommand(packageName, false)

	// If update failed with "app already exists" error and it's a cask, retry with --force
	if shouldRetry && a.isPackageCask(packageName) {
		rt.EventsEmit(a.ctx, "packageUpdateProgress", a.getBackendMessage("updateRetryingWithForce", map[string]string{"name": packageName}))
		finalMessage, wailbrewUpdated, _ = a.runUpdateCommand(packageName, true)
	}

	// Signal completion
	rt.EventsEmit(a.ctx, "packageUpdateComplete", finalMessage)

	// If WailBrew was updated, emit event to show restart dialog
	if wailbrewUpdated && a.ctx != nil {
		rt.EventsEmit(a.ctx, "wailbrewUpdated")
	}

	return finalMessage
}

// runUpdateCommand executes the brew upgrade command and returns the result
func (a *App) runUpdateCommand(packageName string, useForce bool) (finalMessage string, wailbrewUpdated bool, shouldRetry bool) {
	args := []string{"upgrade"}
	if useForce {
		args = append(args, "--force")
	}
	args = append(args, packageName)

	cmd := exec.Command(a.brewPath, args...)
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := a.getBackendMessage("errorStartingUpdate", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	}

	// Capture stderr for error detection
	var stderrOutput strings.Builder

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("📦 %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				stderrOutput.WriteString(line)
				stderrOutput.WriteString("\n")
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	if err != nil {
		stderrStr := stderrOutput.String()
		// Check if this is the "app already exists" error and we haven't tried --force yet
		if !useForce && a.isAppAlreadyExistsError(stderrStr) {
			return "", false, true
		}
		finalMessage = a.getBackendMessage("updateFailed", map[string]string{"name": packageName, "error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
		return finalMessage, false, false
	}

	finalMessage = a.getBackendMessage("updateSuccess", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)

	// Check if WailBrew itself was updated
	if strings.ToLower(packageName) == "wailbrew" {
		wailbrewUpdated = true
	}

	return finalMessage, wailbrewUpdated, false
}

// UpdateSelectedBrewPackages upgrades specific packages with live progress updates
func (a *App) UpdateSelectedBrewPackages(packageNames []string) string {
	// Validate brew installation first
	if err := a.validateBrewInstallation(); err != nil {
		return fmt.Sprintf("❌ Homebrew validation failed: %v", err)
	}

	if len(packageNames) == 0 {
		return "❌ No packages selected for update"
	}

	// Build brew upgrade command with specific packages
	args := []string{"upgrade"}
	args = append(args, packageNames...)

	cmd := exec.Command(a.brewPath, args...)
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Sprintf("❌ Error creating output pipe: %v", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Sprintf("❌ Error creating error pipe: %v", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Sprintf("❌ Error starting update: %v", err)
	}

	// Track which packages were updated (especially wailbrew)
	updatedPackages := make(map[string]bool)
	var stderrOutput strings.Builder

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("📦 %s", line))

				// Detect if wailbrew is being updated
				if strings.Contains(strings.ToLower(line), "wailbrew") {
					if strings.Contains(line, "Upgrading") || strings.Contains(line, "Installing") {
						parts := strings.Fields(line)
						for i, part := range parts {
							if (part == "Upgrading" || part == "Installing") && i+1 < len(parts) {
								pkgName := strings.ToLower(parts[i+1])
								pkgName = strings.Trim(pkgName, ":.,!?")
								if pkgName == "wailbrew" {
									updatedPackages["wailbrew"] = true
								}
							}
						}
					}
					if strings.Contains(line, "successfully") && strings.Contains(strings.ToLower(line), "wailbrew") {
						updatedPackages["wailbrew"] = true
					}
				}
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				stderrOutput.WriteString(line)
				stderrOutput.WriteString("\n")
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	var finalMessage string
	if err != nil {
		stderrStr := stderrOutput.String()
		// Check if this is the "app already exists" error
		if a.isAppAlreadyExistsError(stderrStr) {
			// Extract failed package names
			failedPackages := a.extractFailedPackagesFromError(stderrStr)
			// Filter to only casks
			var failedCasks []string
			for _, pkg := range failedPackages {
				if a.isPackageCask(pkg) {
					failedCasks = append(failedCasks, pkg)
				}
			}

			// Retry failed casks with --force
			if len(failedCasks) > 0 {
				rt.EventsEmit(a.ctx, "packageUpdateProgress", a.getBackendMessage("updateRetryingFailedCasks", map[string]string{"count": fmt.Sprintf("%d", len(failedCasks))}))
				for _, pkg := range failedCasks {
					rt.EventsEmit(a.ctx, "packageUpdateProgress", a.getBackendMessage("updateRetryingWithForce", map[string]string{"name": pkg}))
					_, _, _ = a.runUpdateCommand(pkg, true)
				}
				finalMessage = fmt.Sprintf("✅ Retried %d failed cask(s) with --force", len(failedCasks))
			} else {
				finalMessage = fmt.Sprintf("❌ Update failed for selected packages: %v", err)
			}
		} else {
			finalMessage = fmt.Sprintf("❌ Update failed for selected packages: %v", err)
		}
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	} else {
		finalMessage = fmt.Sprintf("✅ Successfully updated %d selected package(s)", len(packageNames))
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	}

	// Signal completion
	rt.EventsEmit(a.ctx, "packageUpdateComplete", finalMessage)

	// If WailBrew was updated, emit event to show restart dialog
	if updatedPackages["wailbrew"] && a.ctx != nil {
		rt.EventsEmit(a.ctx, "wailbrewUpdated")
	}

	return finalMessage
}

// UpdateAllBrewPackages upgrades all outdated packages with live progress updates
func (a *App) UpdateAllBrewPackages() string {
	// Emit initial progress
	startMessage := a.getBackendMessage("updateAllStart", map[string]string{})
	rt.EventsEmit(a.ctx, "packageUpdateProgress", startMessage)

	// Use --greedy-auto-updates flag to update casks that can actually be upgraded
	// (excludes casks with version "latest" that self-update)
	cmd := exec.Command(a.brewPath, "upgrade", "--greedy-auto-updates")
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := a.getBackendMessage("errorStartingUpdateAll", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg
	}

	// Track which packages are being updated
	updatedPackages := make(map[string]bool)

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("📦 %s", line))

				// Detect if wailbrew is being updated
				// Look for patterns like "==> Upgrading wailbrew" or "wailbrew was successfully upgraded"
				if strings.Contains(strings.ToLower(line), "wailbrew") {
					// Try to extract package name from lines like "==> Upgrading wailbrew"
					if strings.Contains(line, "Upgrading") || strings.Contains(line, "Installing") {
						parts := strings.Fields(line)
						for i, part := range parts {
							if (part == "Upgrading" || part == "Installing") && i+1 < len(parts) {
								pkgName := strings.ToLower(parts[i+1])
								// Remove any trailing punctuation
								pkgName = strings.Trim(pkgName, ":.,!?")
								if pkgName == "wailbrew" {
									updatedPackages["wailbrew"] = true
								}
							}
						}
					}
					// Also check for success messages
					if strings.Contains(line, "successfully") && strings.Contains(strings.ToLower(line), "wailbrew") {
						updatedPackages["wailbrew"] = true
					}
				}
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	var finalMessage string
	if err != nil {
		finalMessage = a.getBackendMessage("updateAllFailed", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	} else {
		finalMessage = a.getBackendMessage("updateAllSuccess", map[string]string{})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	}

	// Signal completion
	rt.EventsEmit(a.ctx, "packageUpdateComplete", finalMessage)

	// If WailBrew was updated, emit event to show restart dialog
	if updatedPackages["wailbrew"] && a.ctx != nil {
		rt.EventsEmit(a.ctx, "wailbrewUpdated")
	}

	return finalMessage
}

func (a *App) GetBrewPackageInfoAsJson(packageName string) map[string]interface{} {
	// Try as formula first
	output, err := a.runBrewCommand("info", "--json=v2", packageName)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("Failed to get package info: %v", err),
		}
	}

	// Extract JSON portion from output (handling potential Homebrew warnings)
	outputStr := strings.TrimSpace(string(output))
	jsonOutput, warnings, err := extractJSONFromBrewOutput(outputStr)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("Failed to extract JSON from package info: %v", err),
		}
	}

	// Log warnings if any were detected
	if warnings != "" {
		a.appendSessionLog(fmt.Sprintf("Homebrew warnings in package info for %s: %s", packageName, warnings))
	}

	var result struct {
		Formulae []map[string]interface{} `json:"formulae"`
		Casks    []map[string]interface{} `json:"casks"`
	}
	if err := json.Unmarshal([]byte(jsonOutput), &result); err != nil {
		return map[string]interface{}{
			"error": "Failed to parse package info",
		}
	}

	// Check formulae first
	if len(result.Formulae) > 0 {
		return result.Formulae[0]
	}

	// Check casks if not found in formulae
	if len(result.Casks) > 0 {
		caskInfo := result.Casks[0]

		// Normalize cask data to match formula structure for frontend compatibility
		// Convert conflicts_with.cask to conflicts_with array
		if conflictsObj, ok := caskInfo["conflicts_with"].(map[string]interface{}); ok {
			if caskConflicts, ok := conflictsObj["cask"].([]interface{}); ok {
				caskInfo["conflicts_with"] = caskConflicts
			} else {
				caskInfo["conflicts_with"] = []interface{}{}
			}
		}

		// Convert depends_on to dependencies array (simplified)
		// Casks don't really have formula dependencies like formulae do,
		// so we'll just provide an empty array or extract relevant info
		dependencies := []string{}
		if dependsOn, ok := caskInfo["depends_on"].(map[string]interface{}); ok {
			// Check for formula dependencies
			if formulaDeps, ok := dependsOn["formula"].([]interface{}); ok {
				for _, dep := range formulaDeps {
					if depStr, ok := dep.(string); ok {
						dependencies = append(dependencies, depStr)
					}
				}
			}
		}
		caskInfo["dependencies"] = dependencies

		return caskInfo
	}

	return map[string]interface{}{
		"error": "No package info found",
	}
}

func (a *App) GetBrewPackageInfo(packageName string) string {
	output, err := a.runBrewCommand("info", packageName)
	if err != nil {
		return fmt.Sprintf("Error: Failed to get package info: %v", err)
	}

	return string(output)
}

func (a *App) RunBrewDoctor() string {
	output, err := a.runBrewCommand("doctor")
	outputStr := string(output)

	// brew doctor exits with status 1 when there are warnings, which is normal behavior
	// Check if the output contains the standard brew doctor warning preamble
	// If it does, this is expected output and should be displayed as-is
	if err != nil {
		// Check if this is a real error (timeout, command not found, etc.) or just warnings
		// Real errors typically don't contain the standard brew doctor output
		if strings.Contains(outputStr, "Please note that these warnings are just used to help the Homebrew maintainers") ||
			strings.Contains(outputStr, "Warning:") ||
			strings.Contains(outputStr, "Your system is ready to brew") {
			// This is valid brew doctor output with warnings, return it as-is
			return outputStr
		}
		// This is a real error, show error message
		return fmt.Sprintf("Error running brew doctor: %v\n\nOutput:\n%s", err, outputStr)
	}
	return outputStr
}

// GetDeprecatedFormulae parses the brew doctor output and returns a list of deprecated formulae
func (a *App) GetDeprecatedFormulae(doctorOutput string) []string {
	var deprecated []string

	// Look for the deprecated formulae section
	// Pattern: "Warning: Some installed formulae are deprecated or disabled."
	// Followed by: "You should find replacements for the following formulae:"
	// Then a list of formulae, one per line, indented with spaces
	lines := strings.Split(doctorOutput, "\n")
	inDeprecatedSection := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Check if we're entering the deprecated section
		if strings.Contains(trimmed, "Some installed formulae are deprecated or disabled") ||
			strings.Contains(trimmed, "You should find replacements for the following formulae") {
			inDeprecatedSection = true
			continue
		}

		// If we're in the deprecated section and the line starts with spaces (indented),
		// it's likely a formula name
		if inDeprecatedSection {
			// Check if line is indented (starts with spaces) and contains a formula name
			if strings.HasPrefix(line, "  ") && trimmed != "" {
				// Extract formula name (remove leading spaces and any trailing content)
				formula := strings.TrimSpace(trimmed)
				// Remove any trailing colon or other punctuation
				formula = strings.TrimRight(formula, ":")
				if formula != "" {
					deprecated = append(deprecated, formula)
				}
			} else if trimmed == "" {
				// Empty line might be separator, continue
				continue
			} else if !strings.HasPrefix(line, " ") {
				// Line doesn't start with space, we've left the deprecated section
				break
			}
		}
	}

	return deprecated
}

// GetBrewCleanupDryRun runs brew cleanup --dry-run and returns the estimated space that can be freed
func (a *App) GetBrewCleanupDryRun() (string, error) {
	output, err := a.runBrewCommand("cleanup", "--dry-run")
	if err != nil {
		return "", fmt.Errorf("failed to run brew cleanup --dry-run: %w", err)
	}

	outputStr := string(output)

	// Parse the output to find the size estimate
	// Look for pattern like "This operation would free approximately 47.6MB of disk space."
	lines := strings.Split(outputStr, "\n")
	for _, line := range lines {
		if strings.Contains(line, "would free approximately") {
			// Extract the size from the line
			// Pattern: "This operation would free approximately 47.6MB of disk space."
			re := regexp.MustCompile(`approximately ([\d.]+(MB|GB|KB|B))`)
			matches := re.FindStringSubmatch(line)
			if len(matches) > 1 {
				return matches[1], nil
			}
		}
	}

	// If no size found, return empty string (no cleanup needed)
	return "0B", nil
}

func (a *App) RunBrewCleanup() string {
	output, err := a.runBrewCommand("cleanup")
	if err != nil {
		return fmt.Sprintf("Error running brew cleanup: %v\n\nOutput:\n%s", err, string(output))
	}
	return string(output)
}

// GetHomebrewVersion returns the installed Homebrew version
func (a *App) GetHomebrewVersion() (string, error) {
	output, err := a.runBrewCommand("--version")
	if err != nil {
		return "", fmt.Errorf("failed to get Homebrew version: %w", err)
	}

	outputStr := strings.TrimSpace(string(output))
	// Homebrew version output is typically: "Homebrew 4.x.x" or "Homebrew 4.x.x\nHomebrew/homebrew-core..."
	lines := strings.Split(outputStr, "\n")
	if len(lines) > 0 {
		// Extract version from first line (e.g., "Homebrew 4.2.1")
		parts := strings.Fields(lines[0])
		if len(parts) >= 2 {
			return parts[1], nil
		}
		return lines[0], nil
	}
	return outputStr, nil
}

// CheckHomebrewUpdate checks if Homebrew itself is up to date and returns status
// This function checks without actually updating - it reads the git repository status
func (a *App) CheckHomebrewUpdate() (map[string]interface{}, error) {
	// Get current version
	currentVersion, err := a.GetHomebrewVersion()
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"currentVersion": currentVersion,
		"isUpToDate":     true,
		"latestVersion":  currentVersion,
	}

	// Check Homebrew's git repository to see if there are updates
	// First, find the Homebrew installation directory
	brewDir := ""
	if runtime.GOOS == "darwin" {
		if runtime.GOARCH == "arm64" {
			brewDir = "/opt/homebrew"
		} else {
			brewDir = "/usr/local"
		}
	}

	if brewDir != "" {
		// Check if Homebrew directory exists and is a git repo
		gitDir := fmt.Sprintf("%s/.git", brewDir)
		if _, err := os.Stat(gitDir); err == nil {
			// Check git status to see if we're behind
			cmd := exec.Command("git", "-C", brewDir, "rev-list", "--count", "HEAD..origin/HEAD")
			cmd.Env = append(os.Environ(), a.getBrewEnv()...)
			behindOutput, _ := cmd.CombinedOutput()

			// If there are commits behind, an update is available
			behindCount := strings.TrimSpace(string(behindOutput))
			if behindCount != "" && behindCount != "0" {
				// Try to get the latest version tag or commit message
				cmd = exec.Command("git", "-C", brewDir, "describe", "--tags", "origin/HEAD")
				cmd.Env = append(os.Environ(), a.getBrewEnv()...)
				latestTag, _ := cmd.CombinedOutput()
				latestVersion := strings.TrimSpace(string(latestTag))

				if latestVersion != "" {
					result["isUpToDate"] = false
					result["latestVersion"] = latestVersion
				} else {
					// Fallback: just indicate update is available
					result["isUpToDate"] = false
					result["latestVersion"] = "latest"
				}
			}
		}
	}

	return result, nil
}

// UpdateHomebrew updates Homebrew itself (not packages, but Homebrew core)
func (a *App) UpdateHomebrew() string {
	// Emit initial progress
	rt.EventsEmit(a.ctx, "homebrewUpdateProgress", "🔄 Starting Homebrew update...")

	// Update Homebrew core repository
	cmd := exec.Command(a.brewPath, "update")
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := fmt.Sprintf("❌ Error creating output pipe: %v", err)
		rt.EventsEmit(a.ctx, "homebrewUpdateProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := fmt.Sprintf("❌ Error creating error pipe: %v", err)
		rt.EventsEmit(a.ctx, "homebrewUpdateProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := fmt.Sprintf("❌ Error starting Homebrew update: %v", err)
		rt.EventsEmit(a.ctx, "homebrewUpdateProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "homebrewUpdateProgress", fmt.Sprintf("📦 %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "homebrewUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	var finalMessage string
	if err != nil {
		finalMessage = fmt.Sprintf("❌ Homebrew update failed: %v", err)
	} else {
		finalMessage = "✅ Homebrew update completed successfully!"
	}

	// Signal completion (only emit once via complete event, not progress)
	rt.EventsEmit(a.ctx, "homebrewUpdateComplete", finalMessage)

	return finalMessage
}

// GetAppVersion returns the application version
func (a *App) GetAppVersion() string {
	return Version
}

// GetBrewPath returns the current brew path
func (a *App) GetBrewPath() string {
	return a.brewPath
}

// SetBrewPath sets a custom brew path
func (a *App) SetBrewPath(path string) error {
	// Validate that the path exists and is executable
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("brew path does not exist: %s", path)
	}

	// Test if it's actually a brew executable by running --version
	cmd := exec.Command(path, "--version")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("invalid brew executable: %s", path)
	}

	a.brewPath = path
	return nil
}

// GetMirrorSource returns the current mirror source configuration
func (a *App) GetMirrorSource() map[string]string {
	return map[string]string{
		"gitRemote":    a.config.GitRemote,
		"bottleDomain": a.config.BottleDomain,
	}
}

// SetMirrorSource sets the Homebrew mirror source configuration
func (a *App) SetMirrorSource(gitRemote string, bottleDomain string) error {
	// Validate URLs if provided (empty string means use default)
	if gitRemote != "" {
		if !strings.HasPrefix(gitRemote, "http://") && !strings.HasPrefix(gitRemote, "https://") {
			return fmt.Errorf("invalid git remote URL: must start with http:// or https://")
		}
	}
	if bottleDomain != "" {
		if !strings.HasPrefix(bottleDomain, "http://") && !strings.HasPrefix(bottleDomain, "https://") {
			return fmt.Errorf("invalid bottle domain URL: must start with http:// or https://")
		}
	}

	a.config.GitRemote = gitRemote
	a.config.BottleDomain = bottleDomain

	if err := a.config.Save(); err != nil {
		return fmt.Errorf("failed to save config: %v", err)
	}

	return nil
}

// GetOutdatedFlag returns the current outdated flag setting
func (a *App) GetOutdatedFlag() string {
	flag := a.config.OutdatedFlag
	// Default to "greedy-auto-updates" if not set (for backward compatibility)
	if flag == "" {
		return "greedy-auto-updates"
	}
	return flag
}

// SetOutdatedFlag sets the outdated flag configuration
func (a *App) SetOutdatedFlag(flag string) error {
	// Validate flag value
	validFlags := map[string]bool{
		"none":                true,
		"greedy":              true,
		"greedy-auto-updates": true,
	}
	if !validFlags[flag] {
		return fmt.Errorf("invalid outdated flag: must be 'none', 'greedy', or 'greedy-auto-updates'")
	}

	a.config.OutdatedFlag = flag

	if err := a.config.Save(); err != nil {
		return fmt.Errorf("failed to save config: %v", err)
	}

	return nil
}

// GetCaskAppDir returns the current cask app directory setting
// If not set in config, tries to parse from HOMEBREW_CASK_OPTS environment variable
func (a *App) GetCaskAppDir() string {
	if a.config.CaskAppDir != "" {
		return a.config.CaskAppDir
	}

	// Try to parse from environment variable
	caskOpts := os.Getenv("HOMEBREW_CASK_OPTS")
	if caskOpts != "" {
		// Look for --appdir=path pattern
		re := regexp.MustCompile(`--appdir=([^\s]+)`)
		matches := re.FindStringSubmatch(caskOpts)
		if len(matches) > 1 {
			return matches[1]
		}
	}

	return ""
}

// SetCaskAppDir sets the cask app directory configuration
func (a *App) SetCaskAppDir(appDir string) error {
	// Validate path if provided (empty string means use default)
	if appDir != "" {
		// Basic validation: should be an absolute path
		if !filepath.IsAbs(appDir) {
			return fmt.Errorf("cask app directory must be an absolute path")
		}
		// Remove trailing slash if present
		appDir = strings.TrimSuffix(appDir, "/")
	}

	a.config.CaskAppDir = appDir

	if err := a.config.Save(); err != nil {
		return fmt.Errorf("failed to save config: %v", err)
	}

	return nil
}

// SelectCaskAppDir opens a directory picker dialog and returns the selected directory
func (a *App) SelectCaskAppDir() (string, error) {
	if a.ctx == nil {
		return "", fmt.Errorf("application context not available")
	}

	// Get current directory to use as default
	defaultDir := a.GetCaskAppDir()
	if defaultDir == "" {
		defaultDir = "/Applications"
	}

	// Open directory picker dialog
	selectedDir, err := rt.OpenDirectoryDialog(a.ctx, rt.OpenDialogOptions{
		Title:                "Select Cask Application Directory",
		DefaultDirectory:     defaultDir,
		CanCreateDirectories: true,
	})

	if err != nil {
		return "", fmt.Errorf("failed to open directory dialog: %w", err)
	}

	return selectedDir, nil
}

// GetHomebrewCaskVersion gets the available version of wailbrew from Homebrew Cask
func (a *App) GetHomebrewCaskVersion() (string, error) {
	// Validate brew installation first
	if err := a.validateBrewInstallation(); err != nil {
		return "", fmt.Errorf("Homebrew validation failed: %v", err)
	}

	// Run brew info --cask --json=v2 wailbrew
	infoOutput, err := a.runBrewCommand("info", "--cask", "--json=v2", "wailbrew")
	if err != nil {
		return "", fmt.Errorf("failed to get Homebrew Cask info: %v", err)
	}

	// Parse JSON to get version
	var caskInfo struct {
		Casks []struct {
			Token   string `json:"token"`
			Version string `json:"version"`
		} `json:"casks"`
	}

	if err := json.Unmarshal(infoOutput, &caskInfo); err != nil {
		return "", fmt.Errorf("failed to parse Homebrew Cask JSON: %v", err)
	}

	if len(caskInfo.Casks) == 0 {
		return "", fmt.Errorf("wailbrew cask not found in Homebrew")
	}

	version := caskInfo.Casks[0].Version
	if version == "" {
		return "", fmt.Errorf("version not found in Homebrew Cask info")
	}

	return version, nil
}

// compareVersions compares two version strings (e.g., "0.9.1" vs "0.9.2")
// Returns true if version1 > version2
func compareVersions(version1, version2 string) bool {
	// Remove 'v' prefix if present
	v1 := strings.TrimPrefix(strings.TrimSpace(version1), "v")
	v2 := strings.TrimPrefix(strings.TrimSpace(version2), "v")

	// Split versions by dots
	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	// Compare each part
	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		var part1, part2 int
		if i < len(parts1) {
			fmt.Sscanf(parts1[i], "%d", &part1)
		}
		if i < len(parts2) {
			fmt.Sscanf(parts2[i], "%d", &part2)
		}

		if part1 > part2 {
			return true
		}
		if part1 < part2 {
			return false
		}
	}

	// Versions are equal
	return false
}

// CheckForUpdates checks if a newer version of wailbrew is available via Homebrew Cask
func (a *App) CheckForUpdates() (*UpdateInfo, error) {
	currentVersion := Version

	// Get the version available in Homebrew Cask
	homebrewCaskVersion, err := a.GetHomebrewCaskVersion()
	if err != nil {
		// If we can't get Homebrew version, don't show an update notification
		// Log the error but return no update available
		return &UpdateInfo{
			Available:      false,
			CurrentVersion: currentVersion,
			LatestVersion:  currentVersion,
			ReleaseNotes:   "",
			DownloadURL:    "",
			FileSize:       0,
			PublishedAt:    "",
		}, nil
	}

	// Clean versions (remove 'v' prefix)
	currentVersionClean := strings.TrimPrefix(currentVersion, "v")
	homebrewVersionClean := strings.TrimPrefix(homebrewCaskVersion, "v")

	// Compare versions - only show update if Homebrew version is greater
	isUpdateAvailable := compareVersions(homebrewVersionClean, currentVersionClean)

	return &UpdateInfo{
		Available:      isUpdateAvailable,
		CurrentVersion: currentVersion,
		LatestVersion:  homebrewVersionClean,
		ReleaseNotes:   "",
		DownloadURL:    "",
		FileSize:       0,
		PublishedAt:    "",
	}, nil
}

// DownloadAndInstallUpdate downloads and installs the update
func (a *App) DownloadAndInstallUpdate(downloadURL string) error {
	// Create temporary directory
	tempDir := "/tmp/wailbrew_update"
	os.RemoveAll(tempDir)
	os.MkdirAll(tempDir, 0755)

	// Download the update
	resp, err := http.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("failed to download update: %w", err)
	}
	defer resp.Body.Close()

	// Save to temporary file
	zipPath := fmt.Sprintf("%s/wailbrew_update.zip", tempDir)
	zipFile, err := os.Create(zipPath)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	defer zipFile.Close()

	_, err = io.Copy(zipFile, resp.Body)
	if err != nil {
		return fmt.Errorf("failed to save update: %w", err)
	}

	// Unzip the update
	cmd := exec.Command("unzip", "-q", zipPath, "-d", tempDir)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to unzip update: %w", err)
	}

	// Find the app bundle
	appPath := fmt.Sprintf("%s/WailBrew.app", tempDir)
	if _, err := os.Stat(appPath); os.IsNotExist(err) {
		return fmt.Errorf("app bundle not found in update")
	}

	// Get current app location
	currentAppPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get current app path: %w", err)
	}

	// Navigate to the .app bundle root
	for strings.Contains(currentAppPath, ".app/") {
		currentAppPath = strings.Split(currentAppPath, ".app/")[0] + ".app"
		break
	}

	// Create backup
	backupPath := currentAppPath + ".backup"
	os.RemoveAll(backupPath)

	// Replace the app (requires admin privileges)
	script := fmt.Sprintf(`
		osascript -e 'do shell script "rm -rf \\"%s\\" && mv \\"%s\\" \\"%s\\" && mv \\"%s\\" \\"%s\\"" with administrator privileges'
	`, backupPath, currentAppPath, backupPath, appPath, currentAppPath)

	cmd = exec.Command("sh", "-c", script)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to replace app: %w", err)
	}

	// Clean up
	os.RemoveAll(tempDir)

	// Don't auto-restart - let the user restart manually via UI
	// The update has been successfully installed

	return nil
}

// RestartApp restarts the WailBrew application
func (a *App) RestartApp() error {
	// Get current app location
	currentAppPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get current app path: %w", err)
	}

	// Navigate to the .app bundle root
	for strings.Contains(currentAppPath, ".app/") {
		currentAppPath = strings.Split(currentAppPath, ".app/")[0] + ".app"
		break
	}

	// Launch the new version and quit
	go func() {
		// Wait a bit before restarting to ensure clean shutdown
		time.Sleep(500 * time.Millisecond)

		// Use 'open -n' to force a new instance and ensure it launches even if the app is already running
		cmd := exec.Command("open", "-n", currentAppPath)
		err := cmd.Start()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to restart app: %v\n", err)
			// Try alternative method using direct execution
			cmd = exec.Command("open", currentAppPath)
			if err := cmd.Start(); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to restart app (alternative method): %v\n", err)
			}
		}

		// Give macOS time to process the launch before quitting
		time.Sleep(1 * time.Second)
		rt.Quit(a.ctx)
	}()

	return nil
}

// ExportBrewfile exports the current Homebrew installation to a Brewfile
func (a *App) ExportBrewfile(filePath string) error {
	// Run brew bundle dump to the specified file path
	cmd := exec.Command(a.brewPath, "bundle", "dump", "--file="+filePath, "--force")
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("brew bundle dump failed: %v\nOutput: %s", err, string(output))
	}

	return nil
}
