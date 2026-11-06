package brew

import (
	"errors"
	"fmt"
	"hash/fnv"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// InstalledStateService detects changes to the installed Homebrew state that
// happened outside WailBrew (for example `brew install --cask` in a terminal).
//
// It fingerprints the directories Homebrew writes to when packages are
// installed, upgraded, removed or pinned, using only filesystem metadata. That
// keeps the check cheap enough to run every time the window regains focus: no
// brew process is spawned once the directories are resolved.
type InstalledStateService struct {
	executor commandRunner

	mu   sync.Mutex
	dirs []string
}

// NewInstalledStateService creates a new installed-state service.
func NewInstalledStateService(executor commandRunner) *InstalledStateService {
	return &InstalledStateService{executor: executor}
}

// watchedDirs resolves the directories whose contents reflect the installed
// state. The answer is cached after the first success; failures are retried on
// the next call.
func (s *InstalledStateService) watchedDirs() ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.dirs != nil {
		return s.dirs, nil
	}

	resolve := func(flag string) (string, error) {
		output, err := s.executor.RunStdoutOnly(flag)
		if err != nil {
			return "", err
		}
		dir := strings.TrimSpace(string(output))
		if dir == "" {
			return "", fmt.Errorf("brew %s returned no path", flag)
		}
		return dir, nil
	}

	cellar, err := resolve("--cellar")
	if err != nil {
		return nil, err
	}
	caskroom, err := resolve("--caskroom")
	if err != nil {
		return nil, err
	}
	prefix, err := resolve("--prefix")
	if err != nil {
		return nil, err
	}

	s.dirs = []string{
		cellar,
		caskroom,
		// `brew pin` keeps one symlink per pinned formula here.
		filepath.Join(prefix, "var", "homebrew", "pinned"),
	}
	return s.dirs, nil
}

// Fingerprint returns an opaque value that changes whenever a package is
// installed, upgraded, removed, pinned or unpinned. It returns an empty string
// when the state cannot be determined, which callers treat as "unknown".
func (s *InstalledStateService) Fingerprint() string {
	dirs, err := s.watchedDirs()
	if err != nil {
		return ""
	}
	return fingerprintDirs(dirs)
}

// fingerprintDirs hashes each directory's modification time together with the
// name and modification time of every direct child. Adding or removing a
// package changes the parent directory; installing or removing a version
// changes the package's own directory. A missing directory (e.g. no Caskroom
// on a formula-only setup) is part of the fingerprint rather than an error.
func fingerprintDirs(dirs []string) string {
	h := fnv.New64a()
	// Writes to a hash never fail.
	write := func(format string, args ...any) { _, _ = fmt.Fprintf(h, format, args...) }
	for _, dir := range dirs {
		write("dir:%s\n", dir)

		info, err := os.Stat(dir)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				write("missing\n")
			} else {
				write("unreadable\n")
			}
			continue
		}
		write("mtime:%d\n", info.ModTime().UnixNano())

		entries, err := os.ReadDir(dir)
		if err != nil {
			write("unlistable\n")
			continue
		}
		// os.ReadDir returns entries sorted by name, so the hash is stable.
		for _, entry := range entries {
			var mtime int64
			if childInfo, err := entry.Info(); err == nil {
				mtime = childInfo.ModTime().UnixNano()
			}
			write("%s:%d\n", entry.Name(), mtime)
		}
	}
	return fmt.Sprintf("%016x", h.Sum64())
}
