package config

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// The locator lives outside the movable data directory, in the platform's
// application configuration directory. It contains only an absolute file path.
func locationFile() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "WailBrew", "config-location.json"), nil
}

func savedConfigPath() (string, error) {
	path, err := locationFile()
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("read configuration location: %w", err)
	}
	var selected string
	if err := json.Unmarshal(data, &selected); err != nil {
		return "", fmt.Errorf("read configuration location: %w", err)
	}
	if !filepath.IsAbs(selected) {
		return "", fmt.Errorf("saved configuration location must be absolute")
	}
	return selected, nil
}

func writeLocation(path string) error {
	locator, err := locationFile()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(locator), 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(locator), ".location-*")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(f.Name()) }()
	data, err := json.Marshal(path)
	if err == nil {
		_, err = f.Write(data)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(f.Name(), locator)
}

// MoveToDirectory copies settings and snapshots before committing the new
// location. Failures before that commit leave the original location active.
// A nonempty destination is rejected; unrelated files in the source stay put.
// The returned warning describes cleanup failures after a successful move.
func (c *Config) MoveToDirectory(target string) (warning string, err error) {
	storageMu.Lock()
	defer storageMu.Unlock()
	if os.Getenv("WAILBREW_CONFIG_FILE") != "" {
		return "", fmt.Errorf("remove WAILBREW_CONFIG_FILE from the app environment before changing folders")
	}
	if !filepath.IsAbs(target) {
		return "", fmt.Errorf("select an absolute directory path")
	}
	target, err = filepath.EvalSymlinks(target)
	if err != nil {
		return "", err
	}
	current, err := c.resolvedConfigPath()
	if err != nil {
		return "", err
	}
	if err := c.save(); err != nil {
		return "", err
	}
	source, err := filepath.EvalSymlinks(filepath.Dir(current))
	if err != nil {
		return "", err
	}
	if source == target {
		return "", nil
	}
	// Do not allow nesting in either direction (including symlink aliases).
	if within(source, target) || within(target, source) {
		return "", fmt.Errorf("choose a folder outside the current configuration folder")
	}
	locator, err := locationFile()
	if err != nil {
		return "", err
	}
	locatorDir := filepath.Dir(locator)
	if canonical, e := filepath.EvalSymlinks(locatorDir); e == nil {
		locatorDir = canonical
	}
	if within(target, locatorDir) {
		return "", fmt.Errorf("choose a folder other than the application location record folder")
	}
	entries, err := os.ReadDir(target)
	if err != nil {
		return "", err
	}
	if len(entries) != 0 {
		return "", fmt.Errorf("choose an empty folder; existing files will not be overwritten")
	}
	newPath := filepath.Join(target, "config.json")
	committed := false
	configCreated, snapshotsCreated := false, false
	defer func() {
		if !committed {
			if configCreated {
				_ = os.Remove(newPath)
			}
			if snapshotsCreated {
				_ = os.RemoveAll(filepath.Join(target, "snapshots"))
			}
		}
	}()
	// O_EXCL ensures an existing config cannot be overwritten.
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return "", err
	}
	f, err := os.OpenFile(newPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return "", err
	}
	configCreated = true
	_, err = f.Write(data)
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return "", err
	}
	if closeErr != nil {
		return "", closeErr
	}
	oldSnapshots := filepath.Join(source, "snapshots")
	if info, statErr := os.Lstat(oldSnapshots); statErr == nil {
		if !info.IsDir() {
			return "", fmt.Errorf("snapshots must be a directory, not a symlink or file")
		}
		// Reject links and special files so relocation cannot change their meaning.
		if err := filepath.WalkDir(oldSnapshots, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if !entry.IsDir() && !entry.Type().IsRegular() {
				return fmt.Errorf("unsupported snapshot file: %s", path)
			}
			return nil
		}); err != nil {
			return "", err
		}
		if err := os.Mkdir(filepath.Join(target, "snapshots"), 0700); err != nil {
			return "", err
		}
		snapshotsCreated = true
		if err := os.CopyFS(filepath.Join(target, "snapshots"), os.DirFS(oldSnapshots)); err != nil {
			return "", fmt.Errorf("copy snapshots: %w", err)
		}
	} else if !os.IsNotExist(statErr) {
		return "", statErr
	}
	if err := writeLocation(newPath); err != nil {
		return "", fmt.Errorf("remember configuration folder: %w", err)
	}
	c.resolvedPath = newPath
	committed = true
	for _, path := range []string{current, oldSnapshots} {
		if err := os.RemoveAll(path); err != nil {
			warning = "The new folder is active, but some files could not be removed from " + source
		}
	}
	_ = os.Remove(source) // Only removes the old folder if empty.
	return warning, nil
}

func within(parent, child string) bool {
	rel, err := filepath.Rel(parent, child)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
