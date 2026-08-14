package brew

import "testing"

func TestWorkingBrewPathFromShellOutput_ignoresStartupNoise(t *testing.T) {
	output := []byte("loading profile\n/custom/homebrew/bin/brew\nlogin shell ready\n")
	checked := make([]string, 0)

	path := workingBrewPathFromShellOutput(output, func(candidate string) bool {
		checked = append(checked, candidate)
		return candidate == "/custom/homebrew/bin/brew"
	})

	if path != "/custom/homebrew/bin/brew" {
		t.Fatalf("expected working brew path, got %q", path)
	}
	if len(checked) != 2 || checked[0] != "login shell ready" {
		t.Fatalf("expected candidates to be checked from the end, got %v", checked)
	}
}

func TestWorkingBrewPathFromShellOutput_noWorkingCandidate(t *testing.T) {
	output := []byte("loading profile\ncommand not found\n")

	if path := workingBrewPathFromShellOutput(output, func(string) bool { return false }); path != "" {
		t.Fatalf("expected no path, got %q", path)
	}
}

func TestEnvironmentValueFromShellOutput_ignoresStartupNoise(t *testing.T) {
	output := []byte("zprofile\n\x00HOME=/Users/example\x00XDG_CONFIG_HOME=/Users/example/.config\x00")

	if value := environmentValueFromShellOutput(output, "XDG_CONFIG_HOME"); value != "/Users/example/.config" {
		t.Fatalf("expected XDG_CONFIG_HOME from environment output, got %q", value)
	}
}

func TestEnvironmentValueFromShellOutput_ignoresShellExitNoise(t *testing.T) {
	output := []byte("XDG_CONFIG_HOME=/printed/by/profile\n\x00HOME=/Users/example\x00XDG_CONFIG_HOME=/actual/value\x00XDG_CONFIG_HOME=/printed/by/logout\n")

	if value := environmentValueFromShellOutput(output, "XDG_CONFIG_HOME"); value != "/actual/value" {
		t.Fatalf("expected the delimited environment entry, got %q", value)
	}
}

func TestEnvironmentValueFromShellOutput_missingValue(t *testing.T) {
	output := []byte("zprofile\n\x00HOME=/Users/example\x00SHELL=/bin/zsh\x00")

	if value := environmentValueFromShellOutput(output, "XDG_CONFIG_HOME"); value != "" {
		t.Fatalf("expected no XDG_CONFIG_HOME, got %q", value)
	}
}

// Homebrew 6 stores tap/formula/cask trust state in
// ${XDG_CONFIG_HOME}/homebrew/trust.json when XDG_CONFIG_HOME is set, and in
// ~/.homebrew/trust.json otherwise. A macOS GUI app inherits no login-shell
// environment, so WailBrew runs brew without XDG_CONFIG_HOME and Homebrew reads
// the wrong (usually non-existent) trust file. Every third-party tap then looks
// untrusted and name-list commands such as `brew list --cask --versions` exit 1.
func TestHomebrewConfigEnv_recoversXDGConfigHomeFromLoginShell(t *testing.T) {
	loginShell := func() string { return "/Users/example/.config" }

	env := homebrewConfigEnv("", loginShell)

	if len(env) != 1 || env[0] != "XDG_CONFIG_HOME=/Users/example/.config" {
		t.Fatalf("expected XDG_CONFIG_HOME to be recovered from the login shell, got %v", env)
	}
}

func TestHomebrewConfigEnv_keepsExistingProcessValue(t *testing.T) {
	loginShell := func() string {
		t.Fatal("login shell must not be queried when the process already has XDG_CONFIG_HOME")
		return ""
	}

	if env := homebrewConfigEnv("/Users/example/.config", loginShell); env != nil {
		t.Fatalf("expected no override when XDG_CONFIG_HOME is already set, got %v", env)
	}
}

func TestHomebrewConfigEnv_noValueAnywhere(t *testing.T) {
	loginShell := func() string { return "" }

	if env := homebrewConfigEnv("", loginShell); env != nil {
		t.Fatalf("expected no entries when XDG_CONFIG_HOME is unset everywhere, got %v", env)
	}
}
