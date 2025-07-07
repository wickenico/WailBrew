package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	rt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx      context.Context
	brewPath string
}

// NewApp creates a new App application struct
func NewApp() *App {
	brewPath := "/opt/homebrew/bin/brew" // ⬅️ Passe hier den Pfad bei Intel-Mac an
	return &App{brewPath: brewPath}
}

// startup saves the application context
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) OpenURL(url string) {
	rt.BrowserOpenURL(a.ctx, url)
}

func (a *App) menu() *menu.Menu {
	AppMenu := menu.NewMenu()

	// App Menü (macOS-like)
	AppSubmenu := AppMenu.AddSubmenu("WailBrew")
	AppSubmenu.AddText("Über Wailbrew", nil, func(cd *menu.CallbackData) {
		rt.MessageDialog(a.ctx, rt.MessageDialogOptions{
			Type:    rt.InfoDialog,
			Title:   "Über Wailbrew",
			Message: "Wailbrew\nv1.0.0\nEin Beispielprojekt.",
		})
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText("Nach Updates suchen…(tbd)", nil, func(cd *menu.CallbackData) {
		//go a.checkForUpdates()
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText("Website besuchen (tbd)", nil, func(cd *menu.CallbackData) {
		//go a.checkForUpdates()
	})
	AppSubmenu.AddText("GitHub Repo besuchen", nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://github.com/wickenico/WailBrew")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText("Beenden", keys.CmdOrCtrl("q"), func(cd *menu.CallbackData) {
		rt.Quit(a.ctx)
	})

	ViewMenu := AppMenu.AddSubmenu("Ansicht")
	ViewMenu.AddText("Installierte Formeln", keys.CmdOrCtrl("1"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "installed")
	})
	ViewMenu.AddText("Veraltete Formeln", keys.CmdOrCtrl("2"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "updatable")
	})
	ViewMenu.AddText("Alle Formeln", keys.CmdOrCtrl("3"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "all")
	})
	ViewMenu.AddText("Blätter", keys.CmdOrCtrl("4"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "casks")
	})
	ViewMenu.AddText("Repositorys", keys.CmdOrCtrl("5"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "repos")
	})
	ViewMenu.AddSeparator()
	ViewMenu.AddText("Doctor", keys.CmdOrCtrl("6"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "doctor")
	})

	// Edit-Menü (optional)
	if runtime.GOOS == "darwin" {
		AppMenu.Append(menu.EditMenu())
		AppMenu.Append(menu.WindowMenu())
	}

	HelpMenu := AppMenu.AddSubmenu("Hilfe")
	HelpMenu.AddText("WailBrew-Hilfe", nil, func(cd *menu.CallbackData) {
		rt.MessageDialog(a.ctx, rt.MessageDialogOptions{
			Type:    rt.InfoDialog,
			Title:   "Hilfe",
			Message: "Aktuell gibt es noch keine Hilfeseite.",
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

	log.Println("✅ Installed Homebrew packages:", packages)
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
		if installedVersion != latestVersion {
			////log.Printf("⬆️ UPDATE AVAILABLE: %s (Installed: %s, Latest: %s)", formula.Name, installedVersion, latestVersion)
			updatablePackages = append(updatablePackages, []string{formula.Name, installedVersion, latestVersion})
		}
	}

	////log.Printf("✅ Found %d updatable packages\n", len(updatablePackages))
	return updatablePackages
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

// UpdateBrewPackage upgrades a package
func (a *App) UpdateBrewPackage(packageName string) string {
	cmd := exec.Command(a.brewPath, "upgrade", packageName)
	cmd.Env = append(os.Environ(), "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")
	output, err := cmd.CombinedOutput()
	if err != nil {
		//log.Printf("❌ ERROR: Failed to upgrade %s: %v\n", packageName, err)
		//log.Println("🔍 Output:", string(output))
		return "Error: " + err.Error()
	}
	//log.Printf("✅ Successfully upgraded %s", packageName)
	return string(output)
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
