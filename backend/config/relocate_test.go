package config

import (
	"os"
	"path/filepath"
	"testing"
)

func isolatedConfig(t *testing.T) (*Config, string) {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("APPDATA", filepath.Join(home, "AppData"))
	t.Setenv("WAILBREW_CONFIG_FILE", "")
	c := &Config{}
	if err := c.Load(); err != nil {
		t.Fatal(err)
	}
	c.LandingTab = "casks"
	c.Favorites = []string{"go"}
	if err := c.Save(); err != nil {
		t.Fatal(err)
	}
	path, err := c.ResolvedPath()
	if err != nil {
		t.Fatal(err)
	}
	snapshots := filepath.Join(filepath.Dir(path), "snapshots")
	if err := os.MkdirAll(snapshots, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(snapshots, "test.Brewfile"), []byte("brew \"go\"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	return c, filepath.Dir(path)
}

func TestMoveConfigDirectory(t *testing.T) {
	c, source := isolatedConfig(t)
	target := t.TempDir()
	warning, err := c.MoveToDirectory(target)
	if err != nil || warning != "" {
		t.Fatalf("move: %q %v", warning, err)
	}
	if _, err := os.Stat(source); !os.IsNotExist(err) {
		t.Fatalf("old directory remains: %v", err)
	}
	var restarted Config
	if err := restarted.Load(); err != nil {
		t.Fatal(err)
	}
	if restarted.LandingTab != "casks" || len(restarted.Favorites) != 1 {
		t.Fatal("lost settings")
	}
	path, _ := restarted.ResolvedPath()
	canonical, _ := filepath.EvalSymlinks(target)
	if path != filepath.Join(canonical, "config.json") {
		t.Fatalf("restart path: %s", path)
	}
	restarted.LandingTab = "all"
	if err := restarted.Save(); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(target, "snapshots", "test.Brewfile"))
	if err != nil || string(data) != "brew \"go\"\n" {
		t.Fatalf("lost snapshot: %s %v", data, err)
	}
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatalf("config permissions: %v %v", info, err)
	}
	// A second move must update the locator rather than leave a redirect chain.
	again := t.TempDir()
	if _, err := restarted.MoveToDirectory(again); err != nil {
		t.Fatal(err)
	}
	var twice Config
	if err := twice.Load(); err != nil {
		t.Fatal(err)
	}
	if twice.LandingTab != "all" {
		t.Fatal("second move lost settings")
	}
}

func TestMovePreservesUnrelatedFiles(t *testing.T) {
	c, source := isolatedConfig(t)
	extra := filepath.Join(source, "notes.txt")
	if err := os.WriteFile(extra, []byte("keep me"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := c.MoveToDirectory(t.TempDir()); err != nil {
		t.Fatal(err)
	}
	if data, err := os.ReadFile(extra); err != nil || string(data) != "keep me" {
		t.Fatal("unrelated source file changed")
	}
}

func TestMoveFailuresKeepOriginal(t *testing.T) {
	for _, scenario := range []string{"occupied", "nested", "relative", "override", "locator failure", "snapshot link"} {
		t.Run(scenario, func(t *testing.T) {
			c, source := isolatedConfig(t)
			oldPath, _ := c.ResolvedPath()
			target := t.TempDir()
			switch scenario {
			case "occupied":
				if err := os.WriteFile(filepath.Join(target, "config.json"), []byte("existing"), 0600); err != nil {
					t.Fatal(err)
				}
			case "nested":
				target = filepath.Join(source, "nested")
				if err := os.Mkdir(target, 0700); err != nil {
					t.Fatal(err)
				}
			case "relative":
				target = "relative"
			case "override":
				t.Setenv("WAILBREW_CONFIG_FILE", oldPath)
			case "locator failure":
				locator, _ := locationFile()
				if err := os.MkdirAll(filepath.Dir(locator), 0700); err != nil {
					t.Fatal(err)
				}
				if err := os.Mkdir(locator, 0700); err != nil {
					t.Fatal(err)
				}
			case "snapshot link":
				if err := os.Symlink(oldPath, filepath.Join(source, "snapshots", "link")); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := c.MoveToDirectory(target); err == nil {
				t.Fatal("expected move failure")
			}
			actual, _ := c.ResolvedPath()
			if actual != oldPath {
				t.Fatal("active path changed on failure")
			}
			if _, err := os.Stat(oldPath); err != nil {
				t.Fatal("original config lost")
			}
			if _, err := os.Stat(filepath.Join(source, "snapshots", "test.Brewfile")); err != nil {
				t.Fatal("original snapshot lost")
			}
			if scenario == "occupied" {
				data, _ := os.ReadFile(filepath.Join(target, "config.json"))
				if string(data) != "existing" {
					t.Fatal("destination overwritten")
				}
			}
			if scenario == "locator failure" || scenario == "snapshot link" {
				entries, err := os.ReadDir(target)
				if err != nil || len(entries) != 0 {
					t.Fatalf("partial destination left: %v %v", entries, err)
				}
			}
		})
	}
}

func TestLegacyAndOverridePrecedence(t *testing.T) {
	_, source := isolatedConfig(t)
	home, _ := os.UserHomeDir()
	legacy := filepath.Join(home, ".wailbrew")
	if err := os.Rename(source, legacy); err != nil {
		t.Fatal(err)
	}
	var old Config
	if err := old.Load(); err != nil {
		t.Fatal(err)
	}
	path, _ := old.ResolvedPath()
	if path != filepath.Join(legacy, "config.json") {
		t.Fatalf("legacy lookup: %s", path)
	}
	if _, err := old.MoveToDirectory(t.TempDir()); err != nil {
		t.Fatal(err)
	}
	t.Setenv("WAILBREW_CONFIG_FILE", filepath.Join(home, "explicit.json"))
	path, err := GetConfigPath()
	if err != nil || path != os.Getenv("WAILBREW_CONFIG_FILE") {
		t.Fatal("explicit override must win")
	}
}

func TestConcurrentSaveAndMove(t *testing.T) {
	c, _ := isolatedConfig(t)
	target := t.TempDir()
	failures := make(chan error, 2)
	go func() {
		for range 20 {
			if err := c.Save(); err != nil {
				failures <- err
				return
			}
			if _, err := c.ResolvedPath(); err != nil {
				failures <- err
				return
			}
		}
		failures <- nil
	}()
	go func() { _, err := c.MoveToDirectory(target); failures <- err }()
	for range 2 {
		if err := <-failures; err != nil {
			t.Fatal(err)
		}
	}
	var restarted Config
	if err := restarted.Load(); err != nil {
		t.Fatal(err)
	}
	if restarted.LandingTab != "casks" {
		t.Fatal("concurrent save lost configuration")
	}
}
