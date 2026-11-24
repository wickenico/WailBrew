package main

import (
	"testing"

	"WailBrew/backend/config"
)

func TestPreviewBrewCommand(t *testing.T) {
	tests := []struct {
		name         string
		outdatedFlag string
		action       string
		targets      []string
		isCask       bool
		zap          bool
		caskTargets  []string
		expected     string
	}{
		{"install", "", "install", []string{"wget"}, false, false, nil, "brew install wget"},
		{"install cask", "", "install", []string{"1password"}, true, false, nil, "brew install --cask 1password"},
		{"uninstall formula", "", "uninstall", []string{"wget"}, false, false, nil, "brew uninstall wget"},
		{"uninstall cask with zap", "", "uninstall", []string{"firefox"}, true, true, nil, "brew uninstall --zap --cask firefox"},
		{"uninstall cask without zap", "", "uninstall", []string{"onedrive"}, true, false, nil, "brew uninstall --cask onedrive"},
		{"upgrade formula", "", "upgrade", []string{"wget"}, false, false, nil, "brew upgrade wget"},
		{"upgrade cask uses default flag", "", "upgrade", []string{"firefox"}, true, false, nil, "brew upgrade --cask --greedy-auto-updates firefox"},
		{"upgrade cask standard mode", "none", "upgrade", []string{"firefox"}, true, false, nil, "brew upgrade --cask firefox"},
		{"upgrade cask greedy", "greedy", "upgrade", []string{"firefox"}, true, false, nil, "brew upgrade --cask --greedy firefox"},
		{"upgrade selected formulae", "greedy", "upgrade-selected", []string{"wget", "jq"}, false, false, nil, "brew upgrade wget jq"},
		{"upgrade selected casks", "greedy", "upgrade-selected", nil, false, false, []string{"onedrive"}, "brew upgrade --cask onedrive"},
		{"upgrade selected mixed", "greedy", "upgrade-selected", []string{"wget"}, false, false, []string{"onedrive", "firefox"}, "brew upgrade wget; brew upgrade --cask onedrive firefox"},
		{"upgrade all", "none", "upgrade-all", nil, false, false, nil, "brew upgrade"},
		{"upgrade all greedy", "greedy", "upgrade-all", nil, false, false, nil, "brew upgrade --greedy"},
		{"tap", "", "tap", []string{"user/repo"}, false, false, nil, "brew tap user/repo"},
		{"tap with url", "", "tap", []string{"user/repo", "https://github.com/user/repo"}, false, false, nil, "brew tap user/repo https://github.com/user/repo"},
		{"untap", "", "untap", []string{"user/repo"}, false, false, nil, "brew untap user/repo"},
		{"trust", "", "trust", []string{"user/repo"}, false, false, nil, "brew trust user/repo"},
		{"unknown action", "", "explode", []string{"wget"}, false, false, nil, ""},
		{"missing target", "", "uninstall", nil, false, false, nil, ""},
		{"empty selection", "", "upgrade-selected", nil, false, false, nil, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := &App{config: &config.Config{OutdatedFlag: tt.outdatedFlag}}
			got := app.PreviewBrewCommand(tt.action, tt.targets, tt.isCask, tt.zap, tt.caskTargets)
			if got != tt.expected {
				t.Errorf("PreviewBrewCommand(%q) = %q, want %q", tt.action, got, tt.expected)
			}
		})
	}
}
