package brew

import "testing"

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
