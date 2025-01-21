package main

import (
	"context"
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

	// Convert output to a slice of strings (splitting by new lines)
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")

	// Create a slice to hold package name and version as separate entries
	var packages [][]string

	// Loop through each line and split into package and version
	for _, line := range lines {
		parts := strings.Fields(line) // Splitting by spaces
		if len(parts) >= 2 {
			packages = append(packages, []string{parts[0], parts[1]}) // [Package, Version]
		} else {
			packages = append(packages, []string{parts[0], "Unknown"}) // If version is missing
		}
	}

	log.Println("✅ Installed Homebrew packages:", packages)
	return packages
}
