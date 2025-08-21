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
	"runtime"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	rt "github.com/wailsapp/wails/v2/pkg/runtime"
)

var Version = "0.dev"

// MenuTranslations holds all menu translations
type MenuTranslations struct {
	App struct {
		About        string `json:"about"`
		CheckUpdates string `json:"checkUpdates"`
		VisitWebsite string `json:"visitWebsite"`
		VisitGitHub  string `json:"visitGitHub"`
		Quit         string `json:"quit"`
	} `json:"app"`
	View struct {
		Title        string `json:"title"`
		Installed    string `json:"installed"`
		Outdated     string `json:"outdated"`
		All          string `json:"all"`
		Leaves       string `json:"leaves"`
		Repositories string `json:"repositories"`
		Doctor       string `json:"doctor"`
	} `json:"view"`
	Help struct {
		Title        string `json:"title"`
		WailbrewHelp string `json:"wailbrewHelp"`
		HelpTitle    string `json:"helpTitle"`
		HelpMessage  string `json:"helpMessage"`
	} `json:"help"`
}

// getMenuTranslations returns translations for the current language
func (a *App) getMenuTranslations() MenuTranslations {
	var translations MenuTranslations

	if a.currentLanguage == "en" {
		translations = MenuTranslations{
			App: struct {
				About        string `json:"about"`
				CheckUpdates string `json:"checkUpdates"`
				VisitWebsite string `json:"visitWebsite"`
				VisitGitHub  string `json:"visitGitHub"`
				Quit         string `json:"quit"`
			}{
				About:        "About WailBrew",
				CheckUpdates: "Check for Updates...",
				VisitWebsite: "Visit Website (tbd)",
				VisitGitHub:  "Visit GitHub Repo",
				Quit:         "Quit",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Doctor       string `json:"doctor"`
			}{
				Title:        "View",
				Installed:    "Installed Formulas",
				Outdated:     "Outdated Formulas",
				All:          "All Formulas",
				Leaves:       "Leaves",
				Repositories: "Repositories",
				Doctor:       "Doctor",
			},
			Help: struct {
				Title        string `json:"title"`
				WailbrewHelp string `json:"wailbrewHelp"`
				HelpTitle    string `json:"helpTitle"`
				HelpMessage  string `json:"helpMessage"`
			}{
				Title:        "Help",
				WailbrewHelp: "WailBrew Help",
				HelpTitle:    "Help",
				HelpMessage:  "Currently there is no help page available.",
			},
		}
	} else {
		// Default to German
		translations = MenuTranslations{
			App: struct {
				About        string `json:"about"`
				CheckUpdates string `json:"checkUpdates"`
				VisitWebsite string `json:"visitWebsite"`
				VisitGitHub  string `json:"visitGitHub"`
				Quit         string `json:"quit"`
			}{
				About:        "Über WailBrew",
				CheckUpdates: "Auf Aktualisierungen prüfen...",
				VisitWebsite: "Website besuchen (tbd)",
				VisitGitHub:  "GitHub Repo besuchen",
				Quit:         "Beenden",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Doctor       string `json:"doctor"`
			}{
				Title:        "Ansicht",
				Installed:    "Installierte Formeln",
				Outdated:     "Veraltete Formeln",
				All:          "Alle Formeln",
				Leaves:       "Blätter",
				Repositories: "Repositories",
				Doctor:       "Doctor",
			},
			Help: struct {
				Title        string `json:"title"`
				WailbrewHelp string `json:"wailbrewHelp"`
				HelpTitle    string `json:"helpTitle"`
				HelpMessage  string `json:"helpMessage"`
			}{
				Title:        "Hilfe",
				WailbrewHelp: "WailBrew-Hilfe",
				HelpTitle:    "Hilfe",
				HelpMessage:  "Aktuell gibt es noch keine Hilfeseite.",
			},
		}
	}

	return translations
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

// App struct
type App struct {
	ctx             context.Context
	brewPath        string
	currentLanguage string
}

// NewApp creates a new App application struct
func NewApp() *App {
	brewPath := "/opt/homebrew/bin/brew" // ⬅️ Passe hier den Pfad bei Intel-Mac an
	return &App{brewPath: brewPath, currentLanguage: "de"}
}

// startup saves the application context
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) OpenURL(url string) {
	rt.BrowserOpenURL(a.ctx, url)
}

// SetLanguage updates the current language and rebuilds the menu
func (a *App) SetLanguage(language string) {
	a.currentLanguage = language
	// Rebuild the menu with new language
	newMenu := a.menu()
	rt.MenuSetApplicationMenu(a.ctx, newMenu)
}

// GetCurrentLanguage returns the current language
func (a *App) GetCurrentLanguage() string {
	return a.currentLanguage
}

// getBackendMessage returns a translated backend message
func (a *App) getBackendMessage(key string, params map[string]string) string {
	messages := make(map[string]string)

	if a.currentLanguage == "en" {
		messages = map[string]string{
			"updateStart":            "🔄 Starting update for '{{name}}'...",
			"updateSuccess":          "✅ Update for '{{name}}' completed successfully!",
			"updateFailed":           "❌ Update for '{{name}}' failed: {{error}}",
			"errorCreatingPipe":      "❌ Error creating output pipe: {{error}}",
			"errorCreatingErrorPipe": "❌ Error creating error pipe: {{error}}",
			"errorStartingUpdate":    "❌ Error starting update: {{error}}",
		}
	} else {
		// Default to German
		messages = map[string]string{
			"updateStart":            "🔄 Starte Update für '{{name}}'...",
			"updateSuccess":          "✅ Update für '{{name}}' erfolgreich abgeschlossen!",
			"updateFailed":           "❌ Update für '{{name}}' fehlgeschlagen: {{error}}",
			"errorCreatingPipe":      "❌ Fehler beim Erstellen der Ausgabe-Pipe: {{error}}",
			"errorCreatingErrorPipe": "❌ Fehler beim Erstellen der Fehler-Pipe: {{error}}",
			"errorStartingUpdate":    "❌ Fehler beim Starten des Updates: {{error}}",
		}
	}

	message, exists := messages[key]
	if !exists {
		return key // Return the key if translation not found
	}

	// Replace parameters
	for param, value := range params {
		message = strings.ReplaceAll(message, "{{"+param+"}}", value)
	}

	return message
}

func (a *App) menu() *menu.Menu {
	translations := a.getMenuTranslations()
	AppMenu := menu.NewMenu()

	// App Menü (macOS-like)
	AppSubmenu := AppMenu.AddSubmenu("WailBrew")
	AppSubmenu.AddText(translations.App.About, nil, func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "showAbout")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(translations.App.CheckUpdates, nil, func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "checkForUpdates")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(translations.App.VisitWebsite, nil, func(cd *menu.CallbackData) {
		//go a.checkForUpdates()
	})
	AppSubmenu.AddText(translations.App.VisitGitHub, nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://github.com/wickenico/WailBrew")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(translations.App.Quit, keys.CmdOrCtrl("q"), func(cd *menu.CallbackData) {
		rt.Quit(a.ctx)
	})

	ViewMenu := AppMenu.AddSubmenu(translations.View.Title)
	ViewMenu.AddText(translations.View.Installed, keys.CmdOrCtrl("1"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "installed")
	})
	ViewMenu.AddText(translations.View.Outdated, keys.CmdOrCtrl("2"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "updatable")
	})
	ViewMenu.AddText(translations.View.All, keys.CmdOrCtrl("3"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "all")
	})
	ViewMenu.AddText(translations.View.Leaves, keys.CmdOrCtrl("4"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "leaves")
	})
	ViewMenu.AddText(translations.View.Repositories, keys.CmdOrCtrl("5"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "repositories")
	})
	ViewMenu.AddSeparator()
	ViewMenu.AddText(translations.View.Doctor, keys.CmdOrCtrl("6"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "doctor")
	})

	// Edit-Menü (optional)
	if runtime.GOOS == "darwin" {
		AppMenu.Append(menu.EditMenu())
		AppMenu.Append(menu.WindowMenu())
	}

	HelpMenu := AppMenu.AddSubmenu(translations.Help.Title)
	HelpMenu.AddText(translations.Help.WailbrewHelp, nil, func(cd *menu.CallbackData) {
		rt.MessageDialog(a.ctx, rt.MessageDialogOptions{
			Type:    rt.InfoDialog,
			Title:   translations.Help.HelpTitle,
			Message: translations.Help.HelpMessage,
		})
	})

	return AppMenu
}

func (a *App) GetAllBrewPackages() [][]string {
	cmd := exec.Command(a.brewPath, "formulae")
	output, err := cmd.Output()
	if err != nil {
		return [][]string{{"Fehler", err.Error()}}
	}
	lines := strings.Split(string(output), "\n")
	var results [][]string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			results = append(results, []string{line, ""})
		}
	}
	return results
}

// GetBrewPackages retrieves the list of installed Homebrew packages
func (a *App) GetBrewPackages() [][]string {
	cmd := exec.Command(a.brewPath, "list", "--formula", "--versions")
	cmd.Env = append(os.Environ(), "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")

	output, err := cmd.CombinedOutput()
	if err != nil {
		////log.Println("❌ ERROR: 'brew list --versions' failed:", err)
		////log.Println("🔍 Output:", string(output))
		return [][]string{{"Error", "fetching brew packages"}}
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	var packages [][]string

	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) >= 2 {
			packages = append(packages, []string{parts[0], parts[1]})
		} else {
			packages = append(packages, []string{parts[0], "Unknown"})
		}
	}

	//log.Println("✅ Installed Homebrew packages:", packages)
	return packages
}

// GetBrewUpdatablePackages checks which packages have updates available
func (a *App) GetBrewUpdatablePackages() [][]string {
	installedPackages := a.GetBrewPackages()
	if len(installedPackages) == 1 && installedPackages[0][0] == "Error" {
		return [][]string{{"Error", "fetching updatable packages"}}
	}

	// Build list of package names
	var names []string
	for _, pkg := range installedPackages {
		names = append(names, pkg[0])
	}

	// Run brew info --json=v2 <packages>
	cmd := exec.Command(a.brewPath, "info", "--json=v2")
	cmd.Args = append(cmd.Args, names...)
	cmd.Env = append(os.Environ(), "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")

	output, err := cmd.CombinedOutput()
	if err != nil {
		////log.Println("❌ ERROR: 'brew info' failed:", err)
		////log.Println("🔍 Output:", string(output))
		return [][]string{{"Error", "fetching updatable packages"}}
	}

	// Parse JSON
	var brewInfo struct {
		Formulae []struct {
			Name     string `json:"name"`
			Versions struct {
				Stable string `json:"stable"`
			} `json:"versions"`
			Deprecated bool `json:"deprecated"`
			Disabled   bool `json:"disabled"`
		} `json:"formulae"`
	}
	if err := json.Unmarshal(output, &brewInfo); err != nil {
		////log.Println("❌ ERROR: Parsing 'brew info' JSON failed:", err)
		return [][]string{{"Error", "parsing brew info"}}
	}

	// Compare versions
	installedMap := make(map[string]string)
	for _, pkg := range installedPackages {
		installedMap[pkg[0]] = pkg[1]
	}

	var updatablePackages [][]string
	for _, formula := range brewInfo.Formulae {
		installedVersion := strings.Split(installedMap[formula.Name], "_")[0]
		latestVersion := formula.Versions.Stable

		// Skip deprecated or disabled packages
		if formula.Deprecated || formula.Disabled {
			continue
		}

		if installedVersion != latestVersion {
			////log.Printf("⬆️ UPDATE AVAILABLE: %s (Installed: %s, Latest: %s)", formula.Name, installedVersion, latestVersion)
			updatablePackages = append(updatablePackages, []string{formula.Name, installedVersion, latestVersion})
		}
	}

	////log.Printf("✅ Found %d updatable packages\n", len(updatablePackages))
	return updatablePackages
}

func (a *App) GetBrewLeaves() []string {
	cmd := exec.Command(a.brewPath, "leaves")
	output, err := cmd.Output()
	if err != nil {
		return []string{"Fehler: " + err.Error()}
	}
	lines := strings.Split(string(output), "\n")
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
	cmd := exec.Command(a.brewPath, "tap")
	output, err := cmd.Output()
	if err != nil {
		return [][]string{{"Fehler", err.Error()}}
	}
	lines := strings.Split(string(output), "\n")
	var taps [][]string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			taps = append(taps, []string{line, "Active"})
		}
	}
	return taps
}

// RemoveBrewPackage uninstalls a package
func (a *App) RemoveBrewPackage(packageName string) string {
	cmd := exec.Command(a.brewPath, "uninstall", packageName)
	cmd.Env = append(os.Environ(), "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")
	output, err := cmd.CombinedOutput()
	if err != nil {
		//log.Printf("❌ ERROR: Failed to uninstall %s: %v\n", packageName, err)
		//log.Println("🔍 Output:", string(output))
		return "Error: " + err.Error()
	}
	//log.Printf("✅ Successfully uninstalled %s", packageName)
	return string(output)
}

// UpdateBrewPackage upgrades a package with live progress updates
func (a *App) UpdateBrewPackage(packageName string) string {
	// Emit initial progress
	startMessage := a.getBackendMessage("updateStart", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageUpdateProgress", startMessage)

	cmd := exec.Command(a.brewPath, "upgrade", packageName)
	cmd.Env = append(os.Environ(), "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")

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
		errorMsg := a.getBackendMessage("errorStartingUpdate", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg
	}

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
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	var finalMessage string
	if err != nil {
		finalMessage = a.getBackendMessage("updateFailed", map[string]string{"name": packageName, "error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	} else {
		finalMessage = a.getBackendMessage("updateSuccess", map[string]string{"name": packageName})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	}

	// Signal completion
	rt.EventsEmit(a.ctx, "packageUpdateComplete", finalMessage)

	return finalMessage
}

func (a *App) GetBrewPackageInfoAsJson(packageName string) map[string]interface{} {
	cmd := exec.Command(a.brewPath, "info", "--json=v2", packageName)
	cmd.Env = append(os.Environ(), "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")

	output, err := cmd.CombinedOutput()
	if err != nil {
		//log.Println("❌ ERROR: 'brew info' failed:", err)
		return map[string]interface{}{
			"error": "Failed to get package info",
		}
	}

	var result struct {
		Formulae []map[string]interface{} `json:"formulae"`
	}
	if err := json.Unmarshal(output, &result); err != nil {
		//log.Println("❌ ERROR: parsing brew info:", err)
		return map[string]interface{}{
			"error": "Failed to parse package info",
		}
	}

	if len(result.Formulae) > 0 {
		return result.Formulae[0]
	}
	return map[string]interface{}{
		"error": "No package info found",
	}
}

func (a *App) GetBrewPackageInfo(packageName string) string {
	cmd := exec.Command(a.brewPath, "info", packageName)
	cmd.Env = append(os.Environ(), "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")

	output, err := cmd.CombinedOutput()
	if err != nil {
		//log.Printf("❌ ERROR: 'brew info' failed for %s: %v\n", packageName, err)
		//log.Println("🔍 Output:", string(output))
		return "Fehler beim Abrufen der Paket-Informationen:\n" + err.Error()
	}

	return string(output)
}

func (a *App) RunBrewDoctor() string {
	cmd := exec.Command(a.brewPath, "doctor")
	out, _ := cmd.CombinedOutput()
	return string(out)
}

// GetAppVersion returns the application version
func (a *App) GetAppVersion() string {
	return Version
}

// CheckForUpdates checks if a new version is available on GitHub
func (a *App) CheckForUpdates() (*UpdateInfo, error) {
	currentVersion := Version

	// Fetch latest release from GitHub API
	resp, err := http.Get("https://api.github.com/repos/wickenico/WailBrew/releases/latest")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch release info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var release GitHubRelease
	if err := json.Unmarshal(body, &release); err != nil {
		return nil, fmt.Errorf("failed to parse release info: %w", err)
	}

	// Find the macOS app asset
	var downloadURL string
	var fileSize int64
	for _, asset := range release.Assets {
		if strings.Contains(asset.Name, "wailbrew") && strings.Contains(asset.Name, ".zip") {
			downloadURL = asset.BrowserDownloadURL
			fileSize = asset.Size
			break
		}
	}

	// Compare versions (simple string comparison for now)
	latestVersion := strings.TrimPrefix(release.TagName, "v")
	currentVersionClean := strings.TrimPrefix(currentVersion, "v")

	updateInfo := &UpdateInfo{
		Available:      latestVersion != currentVersionClean && currentVersionClean != "dev",
		CurrentVersion: currentVersion,
		LatestVersion:  latestVersion,
		ReleaseNotes:   release.Body,
		DownloadURL:    downloadURL,
		FileSize:       fileSize,
		PublishedAt:    release.PublishedAt,
	}

	return updateInfo, nil
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

	// Schedule restart
	go func() {
		time.Sleep(1 * time.Second)
		exec.Command("open", currentAppPath).Start()
		rt.Quit(a.ctx)
	}()

	return nil
}
