package brew

import (
	"reflect"
	"testing"
)

func TestBuildUninstallArgs(t *testing.T) {
	tests := []struct {
		name     string
		pkg      string
		zap      bool
		isCask   bool
		expected []string
	}{
		{"formula", "wget", false, false, []string{"uninstall", "wget"}},
		{"formula with zap requested", "wget", true, false, []string{"uninstall", "wget"}},
		{"cask without zap", "firefox", false, true, []string{"uninstall", "firefox"}},
		{"cask with zap", "firefox", true, true, []string{"uninstall", "--zap", "--cask", "firefox"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BuildUninstallArgs(tt.pkg, tt.zap, tt.isCask)
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("BuildUninstallArgs() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestBuildUpgradeArgs(t *testing.T) {
	tests := []struct {
		name         string
		pkg          string
		isCask       bool
		outdatedFlag string
		force        bool
		expected     []string
	}{
		{"formula ignores greedy", "wget", false, OutdatedFlagGreedy, false, []string{"upgrade", "wget"}},
		{"cask standard mode", "firefox", true, OutdatedFlagNone, false, []string{"upgrade", "firefox"}},
		{"cask greedy", "firefox", true, OutdatedFlagGreedy, false, []string{"upgrade", "--greedy", "firefox"}},
		{"cask greedy auto updates", "firefox", true, OutdatedFlagGreedyAutoUpdate, false, []string{"upgrade", "--greedy-auto-updates", "firefox"}},
		{"cask retry with force", "firefox", true, OutdatedFlagGreedyAutoUpdate, true, []string{"upgrade", "--greedy-auto-updates", "--force", "firefox"}},
		{"formula retry with force", "wget", false, OutdatedFlagNone, true, []string{"upgrade", "--force", "wget"}},
		{"unknown flag adds nothing", "firefox", true, "bogus", false, []string{"upgrade", "firefox"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BuildUpgradeArgs(tt.pkg, tt.isCask, tt.outdatedFlag, tt.force)
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("BuildUpgradeArgs() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestBuildUpgradeSelectedArgs(t *testing.T) {
	tests := []struct {
		name     string
		pkgs     []string
		expected []string
	}{
		{"single", []string{"wget"}, []string{"upgrade", "wget"}},
		{"multiple", []string{"wget", "firefox", "jq"}, []string{"upgrade", "wget", "firefox", "jq"}},
		{"empty", nil, []string{"upgrade"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BuildUpgradeSelectedArgs(tt.pkgs)
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("BuildUpgradeSelectedArgs() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestBuildUpgradeAllArgs(t *testing.T) {
	tests := []struct {
		name         string
		outdatedFlag string
		expected     []string
	}{
		{"standard", OutdatedFlagNone, []string{"upgrade"}},
		{"greedy", OutdatedFlagGreedy, []string{"upgrade", "--greedy"}},
		{"greedy auto updates", OutdatedFlagGreedyAutoUpdate, []string{"upgrade", "--greedy-auto-updates"}},
		{"empty flag", "", []string{"upgrade"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BuildUpgradeAllArgs(tt.outdatedFlag)
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("BuildUpgradeAllArgs() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestBuildTapArgs(t *testing.T) {
	tests := []struct {
		name     string
		tap      string
		url      string
		expected []string
	}{
		{"without url", "homebrew/cask", "", []string{"tap", "homebrew/cask"}},
		{"with url", "user/repo", "https://github.com/user/repo", []string{"tap", "user/repo", "https://github.com/user/repo"}},
		{"whitespace url is dropped", "user/repo", "   ", []string{"tap", "user/repo"}},
		{"url is trimmed", "user/repo", " git@github.com:user/repo.git ", []string{"tap", "user/repo", "git@github.com:user/repo.git"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BuildTapArgs(tt.tap, tt.url)
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("BuildTapArgs() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestBuildUntapAndTrustArgs(t *testing.T) {
	if got, want := BuildUntapArgs("user/repo"), []string{"untap", "user/repo"}; !reflect.DeepEqual(got, want) {
		t.Errorf("BuildUntapArgs() = %v, want %v", got, want)
	}
	if got, want := BuildTrustArgs("user/repo"), []string{"trust", "user/repo"}; !reflect.DeepEqual(got, want) {
		t.Errorf("BuildTrustArgs() = %v, want %v", got, want)
	}
	if got, want := BuildInstallArgs("wget"), []string{"install", "wget"}; !reflect.DeepEqual(got, want) {
		t.Errorf("BuildInstallArgs() = %v, want %v", got, want)
	}
}

func TestFormatCommand(t *testing.T) {
	tests := []struct {
		name     string
		args     []string
		expected string
	}{
		{"simple", []string{"uninstall", "wget"}, "brew uninstall wget"},
		{"flags", []string{"uninstall", "--zap", "--cask", "firefox"}, "brew uninstall --zap --cask firefox"},
		{"tap with url", []string{"tap", "user/repo", "https://github.com/user/repo"}, "brew tap user/repo https://github.com/user/repo"},
		{"no args", nil, "brew"},
		{"quotes whitespace", []string{"install", "weird name"}, "brew install 'weird name'"},
		{"quotes shell metacharacters", []string{"install", "a;rm -rf /"}, "brew install 'a;rm -rf /'"},
		{"escapes single quote", []string{"install", "it's"}, `brew install 'it'\''s'`},
		{"empty arg", []string{"install", ""}, "brew install ''"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := FormatCommand(tt.args); got != tt.expected {
				t.Errorf("FormatCommand() = %q, want %q", got, tt.expected)
			}
		})
	}
}
