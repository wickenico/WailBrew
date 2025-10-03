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

// Standard PATH and locale for brew commands
const brewEnvPath = "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
const brewEnvLang = "LANG=en_US.UTF-8"
const brewEnvLCAll = "LC_ALL=en_US.UTF-8"
const brewEnvNoAutoUpdate = "HOMEBREW_NO_AUTO_UPDATE=1"

// MenuTranslations holds all menu translations
type MenuTranslations struct {
	App struct {
		About          string `json:"about"`
		CheckUpdates   string `json:"checkUpdates"`
		VisitWebsite   string `json:"visitWebsite"`
		VisitGitHub    string `json:"visitGitHub"`
		VisitSubreddit string `json:"visitSubreddit"`
		Quit           string `json:"quit"`
	} `json:"app"`
	View struct {
		Title        string `json:"title"`
		Installed    string `json:"installed"`
		Casks        string `json:"casks"`
		Outdated     string `json:"outdated"`
		All          string `json:"all"`
		Leaves       string `json:"leaves"`
		Repositories string `json:"repositories"`
		Doctor       string `json:"doctor"`
		Cleanup      string `json:"cleanup"`
		Settings     string `json:"settings"`
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

	switch a.currentLanguage {
	case "en":
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				VisitSubreddit string `json:"visitSubreddit"`
				Quit           string `json:"quit"`
			}{
				About:          "About WailBrew",
				CheckUpdates:   "Check for Updates...",
				VisitWebsite:   "Visit Website",
				VisitGitHub:    "Visit GitHub Repo",
				VisitSubreddit: "Visit Subreddit",
				Quit:           "Quit",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "View",
				Installed:    "Installed Formulae",
				Casks:        "Casks",
				Outdated:     "Outdated Formulae",
				All:          "All Formulae",
				Leaves:       "Leaves",
				Repositories: "Repositories",
				Doctor:       "Doctor",
				Cleanup:      "Cleanup",
				Settings:     "Settings",
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
	case "de":
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				VisitSubreddit string `json:"visitSubreddit"`
				Quit           string `json:"quit"`
			}{
				About:          "Über WailBrew",
				CheckUpdates:   "Auf Aktualisierungen prüfen...",
				VisitWebsite:   "Website besuchen",
				VisitGitHub:    "GitHub Repo besuchen",
				VisitSubreddit: "Subreddit besuchen",
				Quit:           "Beenden",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "Ansicht",
				Installed:    "Installierte Formeln",
				Casks:        "Casks",
				Outdated:     "Veraltete Formeln",
				All:          "Alle Formeln",
				Leaves:       "Blätter",
				Repositories: "Repositories",
				Doctor:       "Doctor",
				Cleanup:      "Cleanup",
				Settings:     "Einstellungen",
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
	case "fr":
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				VisitSubreddit string `json:"visitSubreddit"`
				Quit           string `json:"quit"`
			}{
				About:          "À propos de WailBrew",
				CheckUpdates:   "Vérifier les mises à jour...",
				VisitWebsite:   "Visiter le site Web",
				VisitGitHub:    "Visiter le dépôt GitHub",
				VisitSubreddit: "Visiter le Subreddit",
				Quit:           "Quitter",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "Affichage",
				Installed:    "Formules Installées",
				Casks:        "Casks",
				Outdated:     "Formules Obsolètes",
				All:          "Toutes les Formules",
				Leaves:       "Feuilles",
				Repositories: "Dépôts",
				Doctor:       "Diagnostic",
				Cleanup:      "Nettoyage",
				Settings:     "Paramètres",
			},
			Help: struct {
				Title        string `json:"title"`
				WailbrewHelp string `json:"wailbrewHelp"`
				HelpTitle    string `json:"helpTitle"`
				HelpMessage  string `json:"helpMessage"`
			}{
				Title:        "Aide",
				WailbrewHelp: "Aide WailBrew",
				HelpTitle:    "Aide",
				HelpMessage:  "Aucune page d'aide n'est actuellement disponible.",
			},
		}
	default:
		// Default to English
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				VisitSubreddit string `json:"visitSubreddit"`
				Quit           string `json:"quit"`
			}{
				About:          "About WailBrew",
				CheckUpdates:   "Check for Updates...",
				VisitWebsite:   "Visit Website",
				VisitGitHub:    "Visit GitHub Repo",
				VisitSubreddit: "Visit Subreddit",
				Quit:           "Quit",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "View",
				Installed:    "Installed Formulae",
				Casks:        "Casks",
				Outdated:     "Outdated Formulae",
				All:          "All Formulae",
				Leaves:       "Leaves",
				Repositories: "Repositories",
				Doctor:       "Doctor",
				Cleanup:      "Cleanup",
				Settings:     "Settings",
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
	return &App{brewPath: brewPath, currentLanguage: "en"}
}

// runBrewCommand executes a brew command and returns output and error
func (a *App) runBrewCommand(args ...string) ([]byte, error) {
	return a.runBrewCommandWithTimeout(30*time.Second, args...)
}

// runBrewCommandWithTimeout executes a brew command with a timeout
func (a *App) runBrewCommandWithTimeout(timeout time.Duration, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, a.brewPath, args...)
	cmd.Env = append(os.Environ(),
		brewEnvPath,
		brewEnvLang,
		brewEnvLCAll,
		brewEnvNoAutoUpdate, // Prevent auto-update on fresh installs
	)

	output, err := cmd.CombinedOutput()

	// Check if the error was due to timeout
	if ctx.Err() == context.DeadlineExceeded {
		return nil, fmt.Errorf("command timed out after %v: brew %v", timeout, args)
	}

	return output, err
}

// validateBrewInstallation checks if brew is working properly
func (a *App) validateBrewInstallation() error {
	// First check if brew executable exists
	if _, err := os.Stat(a.brewPath); os.IsNotExist(err) {
		return fmt.Errorf("brew not found at path: %s", a.brewPath)
	}

	// Try running a simple brew command to verify it works
	_, err := a.runBrewCommand("--version")
	if err != nil {
		return fmt.Errorf("brew is not working properly: %v", err)
	}

	return nil
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
	var messages map[string]string

	switch a.currentLanguage {
	case "en":
		messages = map[string]string{
			"updateStart":            "🔄 Starting update for '{{name}}'...",
			"updateSuccess":          "✅ Update for '{{name}}' completed successfully!",
			"updateFailed":           "❌ Update for '{{name}}' failed: {{error}}",
			"updateAllStart":         "🔄 Starting update for all packages...",
			"updateAllSuccess":       "✅ Update for all packages completed successfully!",
			"updateAllFailed":        "❌ Update for all packages failed: {{error}}",
			"installStart":           "🔄 Starting installation for '{{name}}'...",
			"installSuccess":         "✅ Installation for '{{name}}' completed successfully!",
			"installFailed":          "❌ Installation for '{{name}}' failed: {{error}}",
			"uninstallStart":         "🔄 Starting uninstallation for '{{name}}'...",
			"uninstallSuccess":       "✅ Uninstallation for '{{name}}' completed successfully!",
			"uninstallFailed":        "❌ Uninstallation for '{{name}}' failed: {{error}}",
			"errorCreatingPipe":      "❌ Error creating output pipe: {{error}}",
			"errorCreatingErrorPipe": "❌ Error creating error pipe: {{error}}",
			"errorStartingUpdate":    "❌ Error starting update: {{error}}",
			"errorStartingUpdateAll": "❌ Error starting update all: {{error}}",
			"errorStartingInstall":   "❌ Error starting installation: {{error}}",
			"errorStartingUninstall": "❌ Error starting uninstallation: {{error}}",
		}
	case "de":
		messages = map[string]string{
			"updateStart":            "🔄 Starte Update für '{{name}}'...",
			"updateSuccess":          "✅ Update für '{{name}}' erfolgreich abgeschlossen!",
			"updateFailed":           "❌ Update für '{{name}}' fehlgeschlagen: {{error}}",
			"updateAllStart":         "🔄 Starte Update für alle Pakete...",
			"updateAllSuccess":       "✅ Update für alle Pakete erfolgreich abgeschlossen!",
			"updateAllFailed":        "❌ Update für alle Pakete fehlgeschlagen: {{error}}",
			"installStart":           "🔄 Starte Installation für '{{name}}'...",
			"installSuccess":         "✅ Installation für '{{name}}' erfolgreich abgeschlossen!",
			"installFailed":          "❌ Installation für '{{name}}' fehlgeschlagen: {{error}}",
			"uninstallStart":         "🔄 Starte Deinstallation für '{{name}}'...",
			"uninstallSuccess":       "✅ Deinstallation für '{{name}}' erfolgreich abgeschlossen!",
			"uninstallFailed":        "❌ Deinstallation für '{{name}}' fehlgeschlagen: {{error}}",
			"errorCreatingPipe":      "❌ Fehler beim Erstellen der Ausgabe-Pipe: {{error}}",
			"errorCreatingErrorPipe": "❌ Fehler beim Erstellen der Fehler-Pipe: {{error}}",
			"errorStartingUpdate":    "❌ Fehler beim Starten des Updates: {{error}}",
			"errorStartingUpdateAll": "❌ Fehler beim Starten des Updates aller Pakete: {{error}}",
			"errorStartingInstall":   "❌ Fehler beim Starten der Installation: {{error}}",
			"errorStartingUninstall": "❌ Fehler beim Starten der Deinstallation: {{error}}",
		}
	case "fr":
		messages = map[string]string{
			"updateStart":            "🔄 Démarrage de la mise à jour pour '{{name}}'...",
			"updateSuccess":          "✅ Mise à jour pour '{{name}}' terminée avec succès !",
			"updateFailed":           "❌ Mise à jour pour '{{name}}' échouée : {{error}}",
			"updateAllStart":         "🔄 Démarrage de la mise à jour pour tous les paquets...",
			"updateAllSuccess":       "✅ Mise à jour pour tous les paquets terminée avec succès !",
			"updateAllFailed":        "❌ Mise à jour pour tous les paquets échouée : {{error}}",
			"installStart":           "🔄 Démarrage de l'installation pour '{{name}}'...",
			"installSuccess":         "✅ Installation pour '{{name}}' terminée avec succès !",
			"installFailed":          "❌ Installation pour '{{name}}' échouée : {{error}}",
			"uninstallStart":         "🔄 Démarrage de la désinstallation pour '{{name}}'...",
			"uninstallSuccess":       "✅ Désinstallation pour '{{name}}' terminée avec succès !",
			"uninstallFailed":        "❌ Désinstallation pour '{{name}}' échouée : {{error}}",
			"errorCreatingPipe":      "❌ Erreur lors de la création du pipe de sortie : {{error}}",
			"errorCreatingErrorPipe": "❌ Erreur lors de la création du pipe d'erreur : {{error}}",
			"errorStartingUpdate":    "❌ Erreur lors du démarrage de la mise à jour : {{error}}",
			"errorStartingUpdateAll": "❌ Erreur lors du démarrage de la mise à jour de tous les paquets : {{error}}",
			"errorStartingInstall":   "❌ Erreur lors du démarrage de l'installation : {{error}}",
			"errorStartingUninstall": "❌ Erreur lors du démarrage de la désinstallation : {{error}}",
		}
	default:
		// Default to English
		messages = map[string]string{
			"updateStart":            "🔄 Starting update for '{{name}}'...",
			"updateSuccess":          "✅ Update for '{{name}}' completed successfully!",
			"updateFailed":           "❌ Update for '{{name}}' failed: {{error}}",
			"updateAllStart":         "🔄 Starting update for all packages...",
			"updateAllSuccess":       "✅ Update for all packages completed successfully!",
			"updateAllFailed":        "❌ Update for all packages failed: {{error}}",
			"installStart":           "🔄 Starting installation for '{{name}}'...",
			"installSuccess":         "✅ Installation for '{{name}}' completed successfully!",
			"installFailed":          "❌ Installation for '{{name}}' failed: {{error}}",
			"uninstallStart":         "🔄 Starting uninstallation for '{{name}}'...",
			"uninstallSuccess":       "✅ Uninstallation for '{{name}}' completed successfully!",
			"uninstallFailed":        "❌ Uninstallation for '{{name}}' failed: {{error}}",
			"errorCreatingPipe":      "❌ Error creating output pipe: {{error}}",
			"errorCreatingErrorPipe": "❌ Error creating error pipe: {{error}}",
			"errorStartingUpdate":    "❌ Error starting update: {{error}}",
			"errorStartingUpdateAll": "❌ Error starting update all: {{error}}",
			"errorStartingInstall":   "❌ Error starting installation: {{error}}",
			"errorStartingUninstall": "❌ Error starting uninstallation: {{error}}",
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
		a.OpenURL("https://wailbrew.app")
	})
	AppSubmenu.AddText(translations.App.VisitGitHub, nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://github.com/wickenico/WailBrew")
	})
	AppSubmenu.AddText(translations.App.VisitSubreddit, nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://www.reddit.com/r/WailBrew/")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(translations.App.Quit, keys.CmdOrCtrl("q"), func(cd *menu.CallbackData) {
		rt.Quit(a.ctx)
	})

	ViewMenu := AppMenu.AddSubmenu(translations.View.Title)
	ViewMenu.AddText(translations.View.Installed, keys.CmdOrCtrl("1"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "installed")
	})
	ViewMenu.AddText(translations.View.Casks, keys.CmdOrCtrl("2"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "casks")
	})
	ViewMenu.AddText(translations.View.Outdated, keys.CmdOrCtrl("3"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "updatable")
	})
	ViewMenu.AddText(translations.View.All, keys.CmdOrCtrl("4"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "all")
	})
	ViewMenu.AddText(translations.View.Leaves, keys.CmdOrCtrl("5"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "leaves")
	})
	ViewMenu.AddText(translations.View.Repositories, keys.CmdOrCtrl("6"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "repositories")
	})
	ViewMenu.AddSeparator()
	ViewMenu.AddText(translations.View.Doctor, keys.CmdOrCtrl("7"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "doctor")
	})
	ViewMenu.AddText(translations.View.Cleanup, keys.CmdOrCtrl("8"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "cleanup")
	})
	ViewMenu.AddSeparator()
	ViewMenu.AddText(translations.View.Settings, keys.CmdOrCtrl("9"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "settings")
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
	var packages [][]string

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) >= 2 {
			packages = append(packages, []string{parts[0], parts[1]})
		} else if len(parts) == 1 {
			packages = append(packages, []string{parts[0], "Unknown"})
		}
	}

	return packages
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
			versionMap := make(map[string]string)
			for _, cask := range caskInfo.Casks {
				version := cask.Version
				if version == "" {
					version = "Unknown"
				}
				versionMap[cask.Token] = version
			}

			// Build result array maintaining order
			for _, name := range caskNames {
				version := versionMap[name]
				if version == "" {
					version = "Unknown"
				}
				casks = append(casks, []string{name, version})
			}
			return casks
		}
	}

	// If batch fetch fails (e.g., due to casks in multiple taps),
	// fetch versions individually with error handling
	for _, caskName := range caskNames {
		infoOutput, err := a.runBrewCommand("info", "--cask", "--json=v2", caskName)
		if err != nil {
			// If individual fetch fails, add with unknown version
			casks = append(casks, []string{caskName, "Unknown"})
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
			casks = append(casks, []string{caskName, version})
		} else {
			casks = append(casks, []string{caskName, "Unknown"})
		}
	}

	return casks
}

// GetBrewUpdatablePackages checks which packages have updates available using brew outdated
func (a *App) GetBrewUpdatablePackages() [][]string {
	// Validate brew installation first
	if err := a.validateBrewInstallation(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	// Use brew outdated with JSON output for accurate detection
	output, err := a.runBrewCommand("outdated", "--json=v2")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to check for updates: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	// If output is empty or "[]", no packages are outdated
	if outputStr == "" || outputStr == "[]" {
		return [][]string{}
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

	if err := json.Unmarshal(output, &brewOutdated); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to parse outdated packages: %v", err)}}
	}

	var updatablePackages [][]string

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

		updatablePackages = append(updatablePackages, []string{
			formula.Name,
			installedVersion,
			formula.CurrentVersion,
		})
	}

	// Process casks (applications) - optional, only if you want to include them
	for _, cask := range brewOutdated.Casks {
		installedVersion := "unknown"
		if len(cask.InstalledVersions) > 0 {
			installedVersion = cask.InstalledVersions[0]
		}

		updatablePackages = append(updatablePackages, []string{
			cask.Name,
			installedVersion,
			cask.CurrentVersion,
		})
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

// RemoveBrewPackage uninstalls a package with live progress updates
func (a *App) RemoveBrewPackage(packageName string) string {
	// Emit initial progress
	startMessage := a.getBackendMessage("uninstallStart", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageUninstallProgress", startMessage)

	cmd := exec.Command(a.brewPath, "uninstall", packageName)
	cmd.Env = append(os.Environ(), brewEnvPath, brewEnvLang, brewEnvLCAll, brewEnvNoAutoUpdate)

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
	cmd.Env = append(os.Environ(), brewEnvPath, brewEnvLang, brewEnvLCAll, brewEnvNoAutoUpdate)

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

// UpdateBrewPackage upgrades a package with live progress updates
func (a *App) UpdateBrewPackage(packageName string) string {
	// Emit initial progress
	startMessage := a.getBackendMessage("updateStart", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageUpdateProgress", startMessage)

	cmd := exec.Command(a.brewPath, "upgrade", packageName)
	cmd.Env = append(os.Environ(), brewEnvPath, brewEnvLang, brewEnvLCAll, brewEnvNoAutoUpdate)

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

// UpdateAllBrewPackages upgrades all outdated packages with live progress updates
func (a *App) UpdateAllBrewPackages() string {
	// Emit initial progress
	startMessage := a.getBackendMessage("updateAllStart", map[string]string{})
	rt.EventsEmit(a.ctx, "packageUpdateProgress", startMessage)

	cmd := exec.Command(a.brewPath, "upgrade")
	cmd.Env = append(os.Environ(), brewEnvPath, brewEnvLang, brewEnvLCAll, brewEnvNoAutoUpdate)

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
		finalMessage = a.getBackendMessage("updateAllFailed", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	} else {
		finalMessage = a.getBackendMessage("updateAllSuccess", map[string]string{})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	}

	// Signal completion
	rt.EventsEmit(a.ctx, "packageUpdateComplete", finalMessage)

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

	var result struct {
		Formulae []map[string]interface{} `json:"formulae"`
		Casks    []map[string]interface{} `json:"casks"`
	}
	if err := json.Unmarshal(output, &result); err != nil {
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
	if err != nil {
		return fmt.Sprintf("Error running brew doctor: %v\n\nOutput:\n%s", err, string(output))
	}
	return string(output)
}

func (a *App) RunBrewCleanup() string {
	output, err := a.runBrewCommand("cleanup")
	if err != nil {
		return fmt.Sprintf("Error running brew cleanup: %v\n\nOutput:\n%s", err, string(output))
	}
	return string(output)
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
