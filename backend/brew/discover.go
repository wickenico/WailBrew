package brew

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// discoverTimeout bounds each discovery command so a misbehaving login shell
// (e.g. one that prompts or hangs) can never block the app.
const discoverTimeout = 8 * time.Second

// DiscoverBrewPath attempts to find a working brew executable.
//
// It first queries the user's login shell (which sources their profile and
// therefore knows their real PATH / HOMEBREW_PREFIX — something a macOS GUI app
// does not inherit), and falls back to scanning a set of known install
// locations. It returns the first path where `brew --version` succeeds, or an
// empty string if no working Homebrew could be found.
func DiscoverBrewPath() string {
	if path := discoverViaLoginShell(); path != "" {
		return path
	}
	for _, candidate := range knownBrewLocations() {
		if isWorkingBrew(candidate) {
			return candidate
		}
	}
	return ""
}

// discoverViaLoginShell runs `$SHELL -lc 'command -v brew'` so we pick up the
// user's real environment (custom HOMEBREW_PREFIX, non-default arch prefix, etc.).
func discoverViaLoginShell() string {
	shell := strings.TrimSpace(os.Getenv("SHELL"))
	if shell == "" {
		shell = "/bin/zsh"
	}

	output, err := runHostWithTimeout(shell, "-lc", "command -v brew")
	if err != nil {
		return ""
	}

	path := strings.TrimSpace(string(output))
	// `command -v` may emit more than one line; the executable path is first.
	if idx := strings.IndexByte(path, '\n'); idx >= 0 {
		path = strings.TrimSpace(path[:idx])
	}
	if path == "" {
		return ""
	}

	if isWorkingBrew(path) {
		return path
	}
	return ""
}

// knownBrewLocations returns candidate brew paths to scan, including any
// HOMEBREW_PREFIX from the environment and a user-local install.
func knownBrewLocations() []string {
	locations := []string{
		"/opt/workbrew/bin/brew",
		"/opt/homebrew/bin/brew",
		"/usr/local/bin/brew",
		"/home/linuxbrew/.linuxbrew/bin/brew",
	}

	if prefix := strings.TrimSpace(os.Getenv("HOMEBREW_PREFIX")); prefix != "" {
		locations = append(locations, filepath.Join(prefix, "bin", "brew"))
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		locations = append(locations, filepath.Join(home, "homebrew", "bin", "brew"))
	}

	return locations
}

// isWorkingBrew reports whether the given path is an existing, runnable brew.
func isWorkingBrew(path string) bool {
	if path == "" {
		return false
	}
	if _, err := os.Stat(path); err != nil {
		return false
	}
	if _, err := runHostWithTimeout(path, "--version"); err != nil {
		return false
	}
	return true
}

// runHostWithTimeout executes a host command with a bounded timeout and returns
// its stdout. Unlike the brew Executor, this uses the inherited process
// environment so login-shell PATH resolution behaves as expected.
func runHostWithTimeout(name string, arg ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), discoverTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, arg...)
	cmd.Env = os.Environ()
	return cmd.Output()
}
