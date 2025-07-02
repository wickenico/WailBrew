package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/exec"
	"strings"
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

// GetBrewPackages retrieves the list of installed Homebrew packages
func (a *App) GetBrewPackages() [][]string {
	cmd := exec.Command("brew", "list", "--formula", "--versions")
	cmd.Env = append(os.Environ(), "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Println("❌ ERROR: 'brew list --versions' failed:", err)
		log.Println("🔍 Output:", string(output))
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
		log.Println("❌ ERROR: 'brew info' failed:", err)
		log.Println("🔍 Output:", string(output))
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
		log.Println("❌ ERROR: Parsing 'brew info' JSON failed:", err)
		return [][]string{{"Error", "parsing brew info"}}
	}

	// Compare versions
	installedMap := make(map[string]string)
	for _, pkg := range installedPackages {
		installedMap[pkg[0]] = pkg[1]
	}

	var updatablePackages [][]string
	for _, formula := range brewInfo.Formulae {
		installedVersion := installedMap[formula.Name]
		latestVersion := formula.Versions.Stable
		if installedVersion != latestVersion {
			log.Printf("⬆️ UPDATE AVAILABLE: %s (Installed: %s, Latest: %s)", formula.Name, installedVersion, latestVersion)
			updatablePackages = append(updatablePackages, []string{formula.Name, installedVersion, latestVersion})
		}
	}

	log.Printf("✅ Found %d updatable packages\n", len(updatablePackages))
	return updatablePackages
}

// RemoveBrewPackage uninstalls a package
func (a *App) RemoveBrewPackage(packageName string) string {
	cmd := exec.Command(a.brewPath, "uninstall", packageName)
	cmd.Env = append(os.Environ(), "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("❌ ERROR: Failed to uninstall %s: %v\n", packageName, err)
		log.Println("🔍 Output:", string(output))
		return "Error: " + err.Error()
	}
	log.Printf("✅ Successfully uninstalled %s", packageName)
	return string(output)
}

// UpdateBrewPackage upgrades a package
func (a *App) UpdateBrewPackage(packageName string) string {
	cmd := exec.Command(a.brewPath, "upgrade", packageName)
	cmd.Env = append(os.Environ(), "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("❌ ERROR: Failed to upgrade %s: %v\n", packageName, err)
		log.Println("🔍 Output:", string(output))
		return "Error: " + err.Error()
	}
	log.Printf("✅ Successfully upgraded %s", packageName)
	return string(output)
}

func (a *App) GetBrewPackageInfo(packageName string) map[string]interface{} {
	cmd := exec.Command(a.brewPath, "info", "--json=v2", packageName)
	cmd.Env = append(os.Environ(), "PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Println("❌ ERROR: 'brew info' failed:", err)
		return map[string]interface{}{
			"error": "Failed to get package info",
		}
	}

	var result struct {
		Formulae []map[string]interface{} `json:"formulae"`
	}
	if err := json.Unmarshal(output, &result); err != nil {
		log.Println("❌ ERROR: parsing brew info:", err)
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
