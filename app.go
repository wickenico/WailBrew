package main

import (
	"context"
	"encoding/json"
	"log"
	"os/exec"
	"strings"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup saves the application context
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetBrewPackages retrieves the list of installed Homebrew packages
func (a *App) GetBrewPackages() [][]string {
	cmd := exec.Command("bash", "-c", "brew list --versions")
	output, err := cmd.Output()
	if err != nil {
		log.Println("❌ ERROR: 'brew list' failed:", err)
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
	// Get installed packages
	installedPackages := a.GetBrewPackages()
	log.Printf("✅ Installed Homebrew packages: %v\n", installedPackages)

	// Build a map of installed package versions for quick lookup
	installedMap := make(map[string]string)
	for _, pkg := range installedPackages {
		installedMap[pkg[0]] = pkg[1]
	}

	// Fetch all package info in a single call
	cmd := exec.Command("bash", "-c", "brew info --json=v2 $(brew list)")
	output, err := cmd.Output()
	if err != nil {
		log.Println("❌ ERROR: 'brew info --json=v2 $(brew list)' failed:", err)
		return [][]string{{"Error", "fetching updatable packages"}}
	}

	// Parse JSON output
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

	// Compare installed versions with latest versions
	var updatablePackages [][]string
	for _, formula := range brewInfo.Formulae {
		installedVersion, exists := installedMap[formula.Name]
		latestVersion := formula.Versions.Stable

		// Check if the package exists in the installed list and is outdated
		if exists && installedVersion != latestVersion {
			log.Printf("⬆️ UPDATE AVAILABLE: %s (Installed: %s, Latest: %s)\n", formula.Name, installedVersion, latestVersion)
			updatablePackages = append(updatablePackages, []string{formula.Name, installedVersion, latestVersion})
		}
	}

	log.Printf("✅ Found %d updatable packages\n", len(updatablePackages))
	return updatablePackages
}

// RemoveBrewPackage uninstalls a package
func (a *App) RemoveBrewPackage(packageName string) string {
	cmd := exec.Command("bash", "-c", "brew uninstall "+packageName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("❌ ERROR: Failed to uninstall %s: %v\n", packageName, err)
		return "Error: " + err.Error()
	}

	log.Printf("✅ Successfully uninstalled %s\n", packageName)
	return string(output)
}

// UpdateBrewPackage Update a single package
func (a *App) UpdateBrewPackage(packageName string) string {
	cmd := exec.Command("bash", "-c", "brew upgrade "+packageName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("❌ ERROR: Failed to upgrade %s: %v\n", packageName, err)
		return "Error: " + err.Error()
	}

	log.Printf("✅ Successfully upgraded %s\n", packageName)
	return string(output)
}
