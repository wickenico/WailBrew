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
		expected     string
	}{
		{"install", "", "install", []string{"wget"}, false, false, "brew install wget"},
		{"uninstall formula", "", "uninstall", []string{"wget"}, false, false, "brew uninstall wget"},
		{"uninstall cask with zap", "", "uninstall", []string{"firefox"}, true, true, "brew uninstall --zap --cask firefox"},
		{"upgrade formula", "", "upgrade", []string{"wget"}, false, false, "brew upgrade wget"},
		{"upgrade cask uses default flag", "", "upgrade", []string{"firefox"}, true, false, "brew upgrade --greedy-auto-updates firefox"},
		{"upgrade cask standard mode", "none", "upgrade", []string{"firefox"}, true, false, "brew upgrade firefox"},
		{"upgrade cask greedy", "greedy", "upgrade", []string{"firefox"}, true, false, "brew upgrade --greedy firefox"},
		{"upgrade selected", "greedy", "upgrade-selected", []string{"wget", "jq"}, false, false, "brew upgrade wget jq"},
		{"upgrade all", "none", "upgrade-all", nil, false, false, "brew upgrade"},
		{"upgrade all greedy", "greedy", "upgrade-all", nil, false, false, "brew upgrade --greedy"},
		{"tap", "", "tap", []string{"user/repo"}, false, false, "brew tap user/repo"},
		{"tap with url", "", "tap", []string{"user/repo", "https://github.com/user/repo"}, false, false, "brew tap user/repo https://github.com/user/repo"},
		{"untap", "", "untap", []string{"user/repo"}, false, false, "brew untap user/repo"},
		{"trust", "", "trust", []string{"user/repo"}, false, false, "brew trust user/repo"},
		{"unknown action", "", "explode", []string{"wget"}, false, false, ""},
		{"missing target", "", "uninstall", nil, false, false, ""},
		{"empty selection", "", "upgrade-selected", nil, false, false, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := &App{config: &config.Config{OutdatedFlag: tt.outdatedFlag}}
			got := app.PreviewBrewCommand(tt.action, tt.targets, tt.isCask, tt.zap)
			if got != tt.expected {
				t.Errorf("PreviewBrewCommand(%q) = %q, want %q", tt.action, got, tt.expected)
			}
		})
	}
}
