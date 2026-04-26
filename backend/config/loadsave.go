package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Config holds application configuration
type Config struct {
	BrewPath           string `json:"brewPath"` // Homebrew binary path (e.g., "/opt/homebrew/bin/brew")
	GitRemote          string `json:"gitRemote"`
	BottleDomain       string `json:"bottleDomain"`
	OutdatedFlag       string `json:"outdatedFlag"`       // "none", "greedy", or "greedy-auto-updates"
	CaskAppDir         string `json:"caskAppDir"`         // Custom directory for cask applications (e.g., "/Applications/3rd-party")
	CustomCaskOpts     string `json:"customCaskOpts"`     // Additional cask options (e.g., "--fontdir=/Library/Fonts --qlplugindir=~/Library/QuickLook")
	CustomOutdatedArgs string `json:"customOutdatedArgs"` // Additional outdated command arguments (e.g., "--verbose --formula")
	AdminUsername      string `json:"adminUsername"`      // Admin username for sudo operations (defaults to current user)
	Proxy              string `json:"proxy"`              // Global proxy setting (e.g., "http://127.0.0.1:7890" or "http://user:pass@127.0.0.1:7890")
	LandingTab         string `json:"landingTab"`         // Tab to focus on startup (default: "installed")
	NoQuarantine       bool   `json:"noQuarantine"`       // Skip quarantine attribute on cask installs (--no-quarantine)

	// Window geometry — persisted across launches so the window opens where it
	// was last left. Zero values mean "not yet captured" and the app falls back
	// to its built-in defaults.
	WindowWidth     int  `json:"windowWidth,omitempty"`
	WindowHeight    int  `json:"windowHeight,omitempty"`
	WindowX         int  `json:"windowX,omitempty"`
	WindowY         int  `json:"windowY,omitempty"`
	WindowMaximized bool `json:"windowMaximized,omitempty"`

	resolvedPath string // internal: remembers which file was loaded so Save() writes back to the same location
}

// GetConfigPath resolves the config file path using a cascading lookup:
//  1. $WAILBREW_CONFIG_FILE          — explicit override
//  2. $XDG_CONFIG_HOME/wailbrew/config.json  — XDG-compliant (defaults to ~/.config)
//  3. ~/.wailbrew/config.json        — legacy path, backward-compatible
//
// For an existing config the first path that exists wins.
// When no config exists yet, the XDG path is returned as the default for new installs.
func GetConfigPath() (string, error) {
	if p := os.Getenv("WAILBREW_CONFIG_FILE"); p != "" {
		return p, nil
	}

	xdgHome := os.Getenv("XDG_CONFIG_HOME")
	if xdgHome == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		xdgHome = filepath.Join(homeDir, ".config")
	}
	xdgPath := filepath.Join(xdgHome, "wailbrew", "config.json")

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	legacyPath := filepath.Join(homeDir, ".wailbrew", "config.json")

	// Return whichever existing file is found first
	for _, p := range []string{xdgPath, legacyPath} {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}

	// No config found — default to XDG for new installs
	return xdgPath, nil
}

// ResolvedPath returns the config file path that was determined during Load.
// Falls back to GetConfigPath if Load has not been called yet.
func (c *Config) ResolvedPath() (string, error) {
	if c.resolvedPath != "" {
		return c.resolvedPath, nil
	}
	return GetConfigPath()
}

// Load reads the configuration from the resolved config path.
func (c *Config) Load() error {
	configPath, err := GetConfigPath()
	if err != nil {
		return err
	}
	c.resolvedPath = configPath

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // No config file yet, use defaults
		}
		return err
	}

	return json.Unmarshal(data, c)
}

// Save writes the configuration back to the path that was resolved during Load.
// If Load was not called, it falls back to GetConfigPath.
func (c *Config) Save() error {
	configPath := c.resolvedPath
	if configPath == "" {
		var err error
		configPath, err = GetConfigPath()
		if err != nil {
			return err
		}
		c.resolvedPath = configPath
	}

	configDir := filepath.Dir(configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0600)
}
