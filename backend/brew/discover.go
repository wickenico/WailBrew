package brew

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
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
	output, err := runHostWithTimeout(loginShell(), "-lc", "command -v brew")
	if err != nil {
		return ""
	}

	return workingBrewPathFromShellOutput(output, isWorkingBrew)
}

// workingBrewPathFromShellOutput finds the actual `command -v brew` result
// without assuming the login shell is silent. Shell startup files may print
// diagnostics before or after the command output, so candidates are checked
// from the end and accepted only when they point to a working brew executable.
func workingBrewPathFromShellOutput(output []byte, isWorking func(string) bool) string {
	lines := strings.Split(string(output), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		candidate := strings.TrimSpace(lines[i])
		if candidate != "" && isWorking(candidate) {
			return candidate
		}
	}
	return ""
}

// loginShell returns the user's login shell, falling back to zsh (the macOS default).
func loginShell() string {
	if shell := strings.TrimSpace(os.Getenv("SHELL")); shell != "" {
		return shell
	}
	return "/bin/zsh"
}

// HomebrewConfigEnv returns extra environment entries so that brew, when launched
// from the macOS GUI, resolves the same Homebrew configuration the user's
// terminal does. Returns nil when nothing needs to be added.
//
// The result is memoized: the environment cannot change while the app is running
// and the lookup spawns a login shell, which getBrewEnv would otherwise repeat on
// every configuration change. Note that the sibling login-shell lookup in
// discoverViaLoginShell is deliberately *not* memoized — CheckBrewLocation re-runs
// it so the app can suggest a fix once the user installs Homebrew or repairs their
// PATH, and a cached answer would freeze that recovery path.
//
// This value is also deliberately not persisted to config.json next to BrewPath.
// A user's shell profile can change between launches, and a stale XDG_CONFIG_HOME
// would silently point Homebrew at the wrong trust file — reviving this bug in a
// form that is much harder to diagnose. Falling back to "unset" instead lets
// Homebrew fail loudly with its own actionable message.
var HomebrewConfigEnv = sync.OnceValue(func() []string {
	return homebrewConfigEnv(os.Getenv("XDG_CONFIG_HOME"), loginShellXDGConfigHome)
})

// loginShellXDGConfigHome asks the user's login shell for its environment so we
// pick up XDG_CONFIG_HOME exported by the profile rather than the empty GUI
// value. Parsing the env output avoids treating unrelated startup diagnostics
// as the variable value.
func loginShellXDGConfigHome() string {
	output, err := runHostWithTimeout(loginShell(), "-lc", `/usr/bin/printf '\0'; /usr/bin/env -0`)
	if err != nil {
		return ""
	}
	return environmentValueFromShellOutput(output, "XDG_CONFIG_HOME")
}

// environmentValueFromShellOutput extracts an exact KEY=value entry from the
// NUL-delimited environment snapshot. The first NUL separates startup output
// from env records; the final NUL keeps any shell-exit output outside them.
func environmentValueFromShellOutput(output []byte, key string) string {
	prefix := key + "="
	records := strings.Split(string(output), "\x00")
	if len(records) < 3 {
		return ""
	}

	for _, record := range records[1 : len(records)-1] {
		if strings.HasPrefix(record, prefix) {
			return strings.TrimSpace(strings.TrimPrefix(record, prefix))
		}
	}
	return ""
}

// homebrewConfigEnv reports the extra environment entries brew needs in order to
// locate the user's Homebrew configuration.
//
// Homebrew 6 keeps tap/formula/cask trust state in
// ${XDG_CONFIG_HOME}/homebrew/trust.json when XDG_CONFIG_HOME is set, and in
// ~/.homebrew/trust.json otherwise. A macOS GUI app inherits no login-shell
// environment, so without this the app reads a different trust file than the
// user's terminal does and every third-party tap appears untrusted.
//
// An existing process value always wins; we only fill in what the GUI lost.
func homebrewConfigEnv(processXDGConfigHome string, loginShellXDGConfigHome func() string) []string {
	if strings.TrimSpace(processXDGConfigHome) != "" {
		return nil
	}

	value := strings.TrimSpace(loginShellXDGConfigHome())
	if value == "" {
		return nil
	}

	return []string{"XDG_CONFIG_HOME=" + value}
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
