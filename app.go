package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/menu"
	rt "github.com/wailsapp/wails/v2/pkg/runtime"

	"WailBrew/backend/brew"
	"WailBrew/backend/config"
	"WailBrew/backend/logging"
	"WailBrew/backend/system"
	"WailBrew/backend/ui"
	"WailBrew/i18n"
)

// Initialize i18n FS from main package's i18n.go
func init() {
	i18n.FS = i18nFS
}

var Version = "0.dev"

// Standard PATH and locale for brew commands (includes Workbrew paths for enterprise users)
const brewEnvPath = "PATH=/opt/workbrew/sbin:/opt/workbrew/bin:/opt/homebrew/sbin:/opt/homebrew/bin:/usr/local/sbin:/usr/local/bin:/usr/bin:/bin"
const brewEnvLang = "LANG=en_US.UTF-8"
const brewEnvLCAll = "LC_ALL=en_US.UTF-8"
const brewEnvNoAutoUpdate = "HOMEBREW_NO_AUTO_UPDATE=1"

// wailsEventEmitter implements brew.EventEmitter for Wails
// It stores the exact context from Wails lifecycle hooks
type wailsEventEmitter struct {
	ctx context.Context
}

func (e *wailsEventEmitter) Emit(event string, data string) {
	// Use the stored context directly - it's the exact context from startup()
	if e.ctx != nil {
		rt.EventsEmit(e.ctx, event, data)
	}
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
type NewPackagesInfo = brew.NewPackagesInfo

// Config represents the application configuration stored in ~/.wailbrew/config.json
type Config = config.Config

// App struct - minimal orchestrator
type App struct {
	ctx               context.Context
	brewPath          string
	currentLanguage   string
	config            *config.Config
	askpassManager    *system.Manager
	sessionLogManager *logging.Manager
	brewExecutor      *brew.Executor
	brewService       brew.Service
	i18nManager       *i18n.Manager
	eventEmitter      *wailsEventEmitter
}

// detectBrewPathByArchitecture detects the brew binary path based on system architecture
// Returns the default path for the architecture, prioritizing architecture-specific paths
func detectBrewPathByArchitecture() string {
	// Check for workbrew first (enterprise users)
	if _, err := os.Stat("/opt/workbrew/bin/brew"); err == nil {
		return "/opt/workbrew/bin/brew"
	}

	// Detect architecture-specific default paths
	switch runtime.GOARCH {
	case "arm64":
		// Apple Silicon Macs
		if _, err := os.Stat("/opt/homebrew/bin/brew"); err == nil {
			return "/opt/homebrew/bin/brew"
		}
	case "amd64", "386":
		// Intel Macs or Linux
		if runtime.GOOS == "darwin" {
			// Intel Macs
			if _, err := os.Stat("/usr/local/bin/brew"); err == nil {
				return "/usr/local/bin/brew"
			}
		} else if runtime.GOOS == "linux" {
			// Linux
			if _, err := os.Stat("/home/linuxbrew/.linuxbrew/bin/brew"); err == nil {
				return "/home/linuxbrew/.linuxbrew/bin/brew"
			}
		}
	}

	// Fallback: try to find brew in PATH
	if path, err := exec.LookPath("brew"); err == nil {
		return path
	}

	// Final fallback: return architecture-specific default
	return getArchitectureDefaultPath()
}

// getArchitectureDefaultPath returns the default brew path for the current architecture
// This is used as a fallback when no brew installation is found
func getArchitectureDefaultPath() string {
	switch runtime.GOARCH {
	case "arm64":
		return "/opt/homebrew/bin/brew"
	case "amd64", "386":
		if runtime.GOOS == "darwin" {
			return "/usr/local/bin/brew"
		}
		return "/home/linuxbrew/.linuxbrew/bin/brew"
	default:
		return "/opt/homebrew/bin/brew"
	}
}

// detectBrewPath automatically detects the brew binary path (legacy function for compatibility)
func detectBrewPath() string {
	return detectBrewPathByArchitecture()
}

// NewApp creates a new App application struct
func NewApp() *App {
	brewPath := detectBrewPath()
	app := &App{
		brewPath:          brewPath,
		currentLanguage:   "en",
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

	// Initialize i18n manager
	var err error
	app.i18nManager, err = i18n.NewManager("en")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to load translations: %v\n", err)
	}

	return app
}

// getBrewEnv returns the standard brew environment variables
func (a *App) getBrewEnv() []string {
	env := []string{
		brewEnvPath,
		brewEnvLang,
		brewEnvLCAll,
		brewEnvNoAutoUpdate,
	}

	// Add SUDO_ASKPASS if askpass helper is available
	if a.askpassManager != nil {
		askpassPath := a.askpassManager.GetPath()
		if askpassPath != "" {
			env = append(env, fmt.Sprintf("SUDO_ASKPASS=%s", askpassPath))
		}
	}

	// Add mirror source environment variables if configured
	if a.config.GitRemote != "" {
		env = append(env, fmt.Sprintf("HOMEBREW_GIT_REMOTE=%s", a.config.GitRemote))
	}
	if a.config.BottleDomain != "" {
		env = append(env, fmt.Sprintf("HOMEBREW_BOTTLE_DOMAIN=%s", a.config.BottleDomain))
	}

	// Build and add HOMEBREW_CASK_OPTS if cask options are configured
	caskOpts := a.buildCaskOpts()
	if caskOpts != "" {
		env = append(env, fmt.Sprintf("HOMEBREW_CASK_OPTS=%s", caskOpts))
	}

	return env
}

// buildCaskOpts builds HOMEBREW_CASK_OPTS by merging UI-configured options with custom options
func (a *App) buildCaskOpts() string {
	var opts []string

	// Add UI-configured appdir if set
	if a.config.CaskAppDir != "" {
		opts = append(opts, fmt.Sprintf("--appdir=%s", a.config.CaskAppDir))
	}

	// Parse and append custom opts, but skip --appdir if already set via UI
	if a.config.CustomCaskOpts != "" {
		customParts := strings.Fields(a.config.CustomCaskOpts)
		hasAppDir := a.config.CaskAppDir != ""

		for _, part := range customParts {
			// Skip --appdir in custom opts if already set via UI setting
			if hasAppDir && strings.HasPrefix(part, "--appdir") {
				continue
			}
			opts = append(opts, part)
		}
	}

	return strings.Join(opts, " ")
}

// startup saves the application context and sets up services
func (a *App) startup(ctx context.Context) {
	// Store the exact context from Wails lifecycle hook
	// This context must be used for all EventsEmit calls
	a.ctx = ctx

	// Load config from file
	if err := a.config.Load(); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to load config: %v\n", err)
	}

	// Auto-detect and set brew path if not explicitly configured
	if a.config.BrewPath == "" {
		// User hasn't set a path in config, use the path detected in NewApp()
		// This preserves workbrew and any custom paths that were found
		// Only save if the detected path actually exists (validates the detection)
		if a.brewPath != "" {
			if _, err := os.Stat(a.brewPath); err == nil {
				// Valid path detected, save it to config
				a.config.BrewPath = a.brewPath
				if err := a.config.Save(); err != nil {
					fmt.Fprintf(os.Stderr, "Warning: failed to save auto-detected brew path: %v\n", err)
				}
			} else {
				// Detected path doesn't exist, fall back to architecture default
				archDefaultPath := getArchitectureDefaultPath()
				if _, err := os.Stat(archDefaultPath); err == nil {
					a.config.BrewPath = archDefaultPath
					a.brewPath = archDefaultPath
					if err := a.config.Save(); err != nil {
						fmt.Fprintf(os.Stderr, "Warning: failed to save architecture default brew path: %v\n", err)
					}
				}
			}
		}
	} else {
		// User has explicitly set a path in config, use it and validate it
		if _, err := os.Stat(a.config.BrewPath); err == nil {
			a.brewPath = a.config.BrewPath
		} else {
			// Config path doesn't exist, fall back to detected path
			fmt.Fprintf(os.Stderr, "Warning: configured brew path %s does not exist, using detected path %s\n", a.config.BrewPath, a.brewPath)
		}
	}

	// Update brew executor with full environment
	a.brewExecutor = brew.NewExecutor(a.brewPath, a.getBrewEnv(), a.sessionLogManager.Append)

	// Set up the askpass helper
	if a.askpassManager != nil {
		if err := a.askpassManager.Setup(); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to setup askpass helper: %v\n", err)
		}
	}

	// Reload translations for current language
	if a.i18nManager != nil {
		if err := a.i18nManager.LoadLanguage(a.currentLanguage); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to load translations: %v\n", err)
		}
	}

	// Create event emitter with the exact context from lifecycle hook
	// Wails requires this exact context instance for EventsEmit to work
	a.eventEmitter = &wailsEventEmitter{ctx: ctx}

	// Initialize brew service with all dependencies
	a.brewService = brew.NewService(
		a.brewExecutor,
		a.brewPath,
		a.getBrewEnv,
		a.sessionLogManager.Append,
		func() error { return a.brewExecutor.ValidateInstallation() },
		func(key string, params map[string]string) string {
			if a.i18nManager != nil {
				return a.i18nManager.GetBackendMessage(key, params)
			}
			return key
		},
		a.eventEmitter,
		func() string { return a.GetOutdatedFlag() },
		func() string { return a.GetCustomOutdatedArgs() },
		brew.ExtractJSONFromOutput,
		brew.ParseWarnings,
	)
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

// menu builds the application menu using the UI module
func (a *App) menu() *menu.Menu {
	return ui.Build(a)
}

// GetContext returns the application context (for ui.AppInterface)
func (a *App) GetContext() context.Context {
	return a.ctx
}

// GetTranslation returns a translation (for ui.AppInterface)
func (a *App) GetTranslation(key string, params map[string]string) string {
	if a.i18nManager != nil {
		return a.i18nManager.GetTranslation(key, params)
	}
	return key
}

// OpenURL opens a URL in the browser
func (a *App) OpenURL(url string) {
	rt.BrowserOpenURL(a.ctx, url)
}

// SetLanguage updates the current language and rebuilds the menu
func (a *App) SetLanguage(language string) {
	a.currentLanguage = language
	if a.i18nManager != nil {
		if err := a.i18nManager.LoadLanguage(language); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to load translations for %s: %v\n", language, err)
		}
	}
	// Rebuild the menu with new language
	newMenu := a.menu()
	rt.MenuSetApplicationMenu(a.ctx, newMenu)
}

// GetCurrentLanguage returns the current language
func (a *App) GetCurrentLanguage() string {
	return a.currentLanguage
}

// GetSessionLogs returns all session logs as a string
func (a *App) GetSessionLogs() string {
	if a.sessionLogManager != nil {
		return a.sessionLogManager.Get()
	}
	return ""
}

// BREW OPERATIONS - Delegation to brew.Service

// StartupData is the type returned by GetStartupData
type StartupData = brew.StartupData

// GetStartupData returns all initial data needed for app startup in a single call
// This is optimized to minimize duplicate brew command executions
func (a *App) GetStartupData() *StartupData {
	return a.brewService.GetStartupData()
}

// GetStartupDataWithUpdate returns startup data after updating the database
func (a *App) GetStartupDataWithUpdate() *StartupData {
	return a.brewService.GetStartupDataWithUpdate()
}

// ClearBrewCache clears the brew command cache (useful after install/remove operations)
func (a *App) ClearBrewCache() {
	a.brewService.ClearCache()
}

func (a *App) GetAllBrewPackages() [][]string {
	return a.brewService.GetAllBrewPackages()
}

func (a *App) GetBrewPackages() [][]string {
	return a.brewService.GetBrewPackages()
}

func (a *App) GetBrewCasks() [][]string {
	return a.brewService.GetBrewCasks()
}

func (a *App) GetBrewLeaves() []string {
	return a.brewService.GetBrewLeaves()
}

func (a *App) GetBrewTaps() [][]string {
	return a.brewService.GetBrewTaps()
}

func (a *App) GetBrewTapInfo(repositoryName string) string {
	return a.brewService.GetBrewTapInfo(repositoryName)
}

func (a *App) GetBrewPackageSizes(packageNames []string) map[string]string {
	return a.brewService.GetBrewPackageSizes(packageNames)
}

func (a *App) GetBrewCaskSizes(caskNames []string) map[string]string {
	return a.brewService.GetBrewCaskSizes(caskNames)
}

func (a *App) UpdateBrewDatabase() error {
	return a.brewService.UpdateBrewDatabase()
}

func (a *App) UpdateBrewDatabaseWithOutput() (string, error) {
	return a.brewService.UpdateBrewDatabaseWithOutput()
}

func (a *App) ParseNewPackagesFromUpdateOutput(output string) *NewPackagesInfo {
	return a.brewService.ParseNewPackagesFromUpdateOutput(output)
}

func (a *App) CheckForNewPackages() (*NewPackagesInfo, error) {
	return a.brewService.CheckForNewPackages()
}

func (a *App) GetBrewUpdatablePackages() [][]string {
	// Note: Database update is now handled separately via GetStartupDataWithUpdate
	// or UpdateBrewDatabase to avoid redundant calls during startup
	return a.brewService.GetBrewUpdatablePackages()
}

// GetBrewUpdatablePackagesWithUpdate updates the database first, then gets updatable packages
// Use this for manual refresh when you want to ensure fresh data
func (a *App) GetBrewUpdatablePackagesWithUpdate() [][]string {
	// Update the formula database first to get latest information
	updateOutput, err := a.brewService.UpdateBrewDatabaseWithOutput()
	// DISABLED: New packages detection and toast notification disabled
	// Detection logic commented out to avoid unnecessary work
	/*
		var newPackages *NewPackagesInfo
		var shouldEmitEvent bool

		// Maximum number of "new" packages to consider as a legitimate update
		// If more than this, it's likely a fresh database sync (first run) rather than actual new packages
		const maxReasonableNewPackages = 100

		if err == nil && updateOutput != "" {
			// Try to detect new packages from update output
			newPackages = a.brewService.ParseNewPackagesFromUpdateOutput(updateOutput)
			totalNew := len(newPackages.NewFormulae) + len(newPackages.NewCasks)
			// Only emit event if there are new packages AND it's not an unreasonably large number
			// (which would indicate a fresh database sync rather than actual new packages)
			if totalNew > 0 && totalNew <= maxReasonableNewPackages {
				shouldEmitEvent = true
			}
		} else {
			// Fallback: try to detect new packages by comparing current list
			detectedPackages, err := a.brewService.CheckForNewPackages()
			if err == nil {
				totalNew := len(detectedPackages.NewFormulae) + len(detectedPackages.NewCasks)
				if totalNew > 0 && totalNew <= maxReasonableNewPackages {
					newPackages = detectedPackages
					shouldEmitEvent = true
				}
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
	*/
	_ = updateOutput // Suppress unused variable warning
	_ = err          // Suppress unused variable warning

	return a.brewService.GetBrewUpdatablePackages()
}

func (a *App) InstallBrewPackage(packageName string) string {
	return a.brewService.InstallBrewPackage(a.ctx, packageName)
}

func (a *App) RemoveBrewPackage(packageName string) string {
	return a.brewService.RemoveBrewPackage(a.ctx, packageName)
}

func (a *App) UpdateBrewPackage(packageName string) string {
	return a.brewService.UpdateBrewPackage(a.ctx, packageName)
}

func (a *App) UpdateSelectedBrewPackages(packageNames []string) string {
	return a.brewService.UpdateSelectedBrewPackages(a.ctx, packageNames)
}

func (a *App) UpdateAllBrewPackages() string {
	return a.brewService.UpdateAllBrewPackages(a.ctx)
}

func (a *App) TapBrewRepository(repositoryName string) string {
	return a.brewService.TapBrewRepository(a.ctx, repositoryName)
}

func (a *App) UntapBrewRepository(repositoryName string) string {
	return a.brewService.UntapBrewRepository(a.ctx, repositoryName)
}

func (a *App) GetBrewPackageInfoAsJson(packageName string) map[string]interface{} {
	return a.brewService.GetBrewPackageInfoAsJson(packageName)
}

func (a *App) GetBrewPackageInfo(packageName string) string {
	return a.brewService.GetBrewPackageInfo(packageName)
}

func (a *App) RunBrewDoctor() string {
	return a.brewService.RunBrewDoctor()
}

func (a *App) GetDeprecatedFormulae(doctorOutput string) []string {
	return a.brewService.GetDeprecatedFormulae(doctorOutput)
}

func (a *App) GetBrewCleanupDryRun() (string, error) {
	return a.brewService.GetBrewCleanupDryRun()
}

func (a *App) RunBrewCleanup() string {
	return a.brewService.RunBrewCleanup()
}

func (a *App) GetHomebrewVersion() (string, error) {
	return a.brewService.GetHomebrewVersion()
}

func (a *App) CheckHomebrewUpdate() (map[string]interface{}, error) {
	return a.brewService.CheckHomebrewUpdate()
}

func (a *App) UpdateHomebrew() string {
	return a.brewService.UpdateHomebrew(a.ctx)
}

func (a *App) GetHomebrewCaskVersion() (string, error) {
	return a.brewService.GetHomebrewCaskVersion()
}

func (a *App) ExportBrewfile(filePath string) error {
	return a.brewService.ExportBrewfile(filePath)
}

func (a *App) OpenConfigFile() error {
	configPath, err := config.GetConfigPath()
	if err != nil {
		return fmt.Errorf("failed to get config path: %w", err)
	}

	// Ensure config file exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// Create config file if it doesn't exist
		if err := a.config.Save(); err != nil {
			return fmt.Errorf("failed to create config file: %w", err)
		}
	}

	// Open the file with the default text editor
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", "-t", configPath)
	case "linux":
		cmd = exec.Command("xdg-open", configPath)
	case "windows":
		cmd = exec.Command("notepad", configPath)
	default:
		return fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to open config file: %w", err)
	}

	return nil
}

// CONFIG OPERATIONS - Simple delegation to config

func (a *App) GetMirrorSource() map[string]string {
	return map[string]string{
		"gitRemote":    a.config.GitRemote,
		"bottleDomain": a.config.BottleDomain,
	}
}

func (a *App) SetMirrorSource(gitRemote string, bottleDomain string) error {
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

	// Update brew executor with new environment
	if a.brewExecutor != nil {
		a.brewExecutor = brew.NewExecutor(a.brewPath, a.getBrewEnv(), a.sessionLogManager.Append)
	}

	return nil
}

func (a *App) GetOutdatedFlag() string {
	flag := a.config.OutdatedFlag
	if flag == "" {
		return "greedy-auto-updates"
	}
	return flag
}

func (a *App) SetOutdatedFlag(flag string) error {
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

func (a *App) GetCaskAppDir() string {
	if a.config.CaskAppDir != "" {
		return a.config.CaskAppDir
	}

	caskOpts := os.Getenv("HOMEBREW_CASK_OPTS")
	if caskOpts != "" {
		re := regexp.MustCompile(`--appdir=([^\s]+)`)
		matches := re.FindStringSubmatch(caskOpts)
		if len(matches) > 1 {
			return matches[1]
		}
	}

	return ""
}

func (a *App) SetCaskAppDir(appDir string) error {
	if appDir != "" {
		if !filepath.IsAbs(appDir) {
			return fmt.Errorf("cask app directory must be an absolute path")
		}
		appDir = strings.TrimSuffix(appDir, "/")
	}

	a.config.CaskAppDir = appDir

	if err := a.config.Save(); err != nil {
		return fmt.Errorf("failed to save config: %v", err)
	}

	// Update brew executor with new environment
	if a.brewExecutor != nil {
		a.brewExecutor = brew.NewExecutor(a.brewPath, a.getBrewEnv(), a.sessionLogManager.Append)
	}

	return nil
}

func (a *App) SelectCaskAppDir() (string, error) {
	if a.ctx == nil {
		return "", fmt.Errorf("application context not available")
	}

	defaultDir := a.GetCaskAppDir()
	if defaultDir == "" {
		defaultDir = "/Applications"
	}

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

func (a *App) GetCustomCaskOpts() string {
	return a.config.CustomCaskOpts
}

func (a *App) SetCustomCaskOpts(opts string) error {
	a.config.CustomCaskOpts = strings.TrimSpace(opts)

	if err := a.config.Save(); err != nil {
		return fmt.Errorf("failed to save config: %v", err)
	}

	// Update brew executor with new environment
	if a.brewExecutor != nil {
		a.brewExecutor = brew.NewExecutor(a.brewPath, a.getBrewEnv(), a.sessionLogManager.Append)
	}

	return nil
}

func (a *App) GetCustomOutdatedArgs() string {
	return a.config.CustomOutdatedArgs
}

func (a *App) SetCustomOutdatedArgs(args string) error {
	a.config.CustomOutdatedArgs = strings.TrimSpace(args)

	if err := a.config.Save(); err != nil {
		return fmt.Errorf("failed to save config: %v", err)
	}

	return nil
}

func (a *App) GetBrewPath() string {
	// Return from config if set, otherwise return current brewPath
	if a.config.BrewPath != "" {
		return a.config.BrewPath
	}
	return a.brewPath
}

func (a *App) SetBrewPath(path string) error {
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("brew path does not exist: %s", path)
	}

	cmd := exec.Command(path, "--version")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("invalid brew executable: %s", path)
	}

	// Update both config and runtime path
	a.config.BrewPath = path
	a.brewPath = path

	// Save to config file
	if err := a.config.Save(); err != nil {
		return fmt.Errorf("failed to save brew path to config: %w", err)
	}

	// Update brew executor with new path
	if a.brewExecutor != nil {
		a.brewExecutor = brew.NewExecutor(a.brewPath, a.getBrewEnv(), a.sessionLogManager.Append)
	}

	return nil
}

func (a *App) GetAppVersion() string {
	return Version
}

// GetMacOSVersion returns the macOS version
func (a *App) GetMacOSVersion() (string, error) {
	return system.GetMacOSVersion()
}

// GetMacOSReleaseName returns the macOS release name (e.g., "Sonoma", "Sequoia")
func (a *App) GetMacOSReleaseName() (string, error) {
	return system.GetMacOSReleaseName()
}

// GetSystemArchitecture returns the system architecture
func (a *App) GetSystemArchitecture() string {
	return system.GetSystemArchitecture()
}

// UPDATE OPERATIONS - App-specific, not brew domain logic

func compareVersions(version1, version2 string) bool {
	v1 := strings.TrimPrefix(strings.TrimSpace(version1), "v")
	v2 := strings.TrimPrefix(strings.TrimSpace(version2), "v")

	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

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

	return false
}

func (a *App) CheckForUpdates() (*UpdateInfo, error) {
	currentVersion := Version

	homebrewCaskVersion, err := a.GetHomebrewCaskVersion()
	if err != nil {
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

	currentVersionClean := strings.TrimPrefix(currentVersion, "v")
	homebrewVersionClean := strings.TrimPrefix(homebrewCaskVersion, "v")

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

func (a *App) DownloadAndInstallUpdate(downloadURL string) error {
	tempDir := "/tmp/wailbrew_update"
	os.RemoveAll(tempDir)
	os.MkdirAll(tempDir, 0755)

	resp, err := http.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("failed to download update: %w", err)
	}
	defer resp.Body.Close()

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

	cmd := exec.Command("unzip", "-q", zipPath, "-d", tempDir)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to unzip update: %w", err)
	}

	appPath := fmt.Sprintf("%s/WailBrew.app", tempDir)
	if _, err := os.Stat(appPath); os.IsNotExist(err) {
		return fmt.Errorf("app bundle not found in update")
	}

	currentAppPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get current app path: %w", err)
	}

	for strings.Contains(currentAppPath, ".app/") {
		currentAppPath = strings.Split(currentAppPath, ".app/")[0] + ".app"
		break
	}

	backupPath := currentAppPath + ".backup"
	os.RemoveAll(backupPath)

	script := fmt.Sprintf(`
		osascript -e 'do shell script "rm -rf \\"%s\\" && mv \\"%s\\" \\"%s\\" && mv \\"%s\\" \\"%s\\"" with administrator privileges'
	`, backupPath, currentAppPath, backupPath, appPath, currentAppPath)

	cmd = exec.Command("sh", "-c", script)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to replace app: %w", err)
	}

	os.RemoveAll(tempDir)

	return nil
}

func (a *App) RestartApp() error {
	currentAppPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get current app path: %w", err)
	}

	for strings.Contains(currentAppPath, ".app/") {
		currentAppPath = strings.Split(currentAppPath, ".app/")[0] + ".app"
		break
	}

	go func() {
		time.Sleep(500 * time.Millisecond)

		cmd := exec.Command("open", "-n", currentAppPath)
		err := cmd.Start()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to restart app: %v\n", err)
			cmd = exec.Command("open", currentAppPath)
			if err := cmd.Start(); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to restart app (alternative method): %v\n", err)
			}
		}

		time.Sleep(1 * time.Second)
		rt.Quit(a.ctx)
	}()

	return nil
}

// DOCK OPERATIONS - macOS-specific

// SetDockBadge sets the macOS dock badge with the given label
// Pass an empty string to clear the badge
func (a *App) SetDockBadge(label string) {
	system.SetDockBadge(label)
}

// SetDockBadgeCount sets the macOS dock badge with a numeric count
// Pass 0 to clear the badge
func (a *App) SetDockBadgeCount(count int) {
	system.SetDockBadgeCount(count)
}
