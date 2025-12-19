package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const appDataDir = ".wailbrew"

// Config holds application configuration
type Config struct {
	BrewPath     string `json:"brewPath"` // Homebrew binary path (e.g., "/opt/homebrew/bin/brew")
	GitRemote    string `json:"gitRemote"`
	BottleDomain string `json:"bottleDomain"`
	OutdatedFlag string `json:"outdatedFlag"` // "none", "greedy", or "greedy-auto-updates"
	CaskAppDir   string `json:"caskAppDir"`   // Custom directory for cask applications (e.g., "/Applications/3rd-party")
}

// GetConfigPath returns the path to the config file
func GetConfigPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, appDataDir, "config.json"), nil
}

// Load loads the configuration from ~/.wailbrew/config.json
func (c *Config) Load() error {
	configPath, err := GetConfigPath()
	if err != nil {
		return err
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // No config file yet, use defaults
		}
		return err
	}

	return json.Unmarshal(data, c)
}

// Save saves the configuration to ~/.wailbrew/config.json
func (c *Config) Save() error {
	configPath, err := GetConfigPath()
	if err != nil {
		return err
	}

	// Create directory if it doesn't exist
	configDir := filepath.Dir(configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}
