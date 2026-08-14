package brew

import (
	"strings"
)

// Outdated detection modes as stored in the configuration. They control which
// --greedy variant is passed to brew upgrade for casks.
const (
	OutdatedFlagNone             = "none"
	OutdatedFlagGreedy           = "greedy"
	OutdatedFlagGreedyAutoUpdate = "greedy-auto-updates"
)

// The builders below are the single source of truth for the arguments passed to
// brew. Both the executing code and the command preview shown in the
// confirmation dialogs use them, so what the user sees is what actually runs.

// BuildInstallArgs builds the arguments for installing a package. Homebrew
// resolves formula vs cask from the token itself, so no --formula/--cask.
func BuildInstallArgs(name string) []string {
	return []string{"install", name}
}

// BuildUninstallArgs builds the arguments for uninstalling a package. --zap is
// only valid for casks, so it is paired with --cask and ignored for formulae.
func BuildUninstallArgs(name string, zap, isCask bool) []string {
	args := []string{"uninstall"}
	if zap && isCask {
		args = append(args, "--zap", "--cask")
	}
	return append(args, name)
}

// BuildUpgradeArgs builds the arguments for upgrading a single package. The
// greedy flags only affect casks; force is used when retrying an upgrade that
// failed because the app already exists.
func BuildUpgradeArgs(name string, isCask bool, outdatedFlag string, force bool) []string {
	args := []string{"upgrade"}
	if isCask {
		args = append(args, greedyFlags(outdatedFlag)...)
	}
	if force {
		args = append(args, "--force")
	}
	return append(args, name)
}

// BuildUpgradeSelectedArgs builds the arguments for upgrading an explicit list
// of packages. No greedy flag is passed here: casks that need it are retried
// individually via BuildUpgradeArgs.
func BuildUpgradeSelectedArgs(names []string) []string {
	return append([]string{"upgrade"}, names...)
}

// BuildUpgradeAllArgs builds the arguments for upgrading everything outdated.
func BuildUpgradeAllArgs(outdatedFlag string) []string {
	return append([]string{"upgrade"}, greedyFlags(outdatedFlag)...)
}

// BuildTapArgs builds the arguments for tapping a repository. The URL is
// optional and only appended when non-empty.
func BuildTapArgs(name, url string) []string {
	args := []string{"tap", name}
	if trimmed := strings.TrimSpace(url); trimmed != "" {
		args = append(args, trimmed)
	}
	return args
}

// BuildUntapArgs builds the arguments for untapping a repository.
func BuildUntapArgs(name string) []string {
	return []string{"untap", name}
}

// BuildTrustArgs builds the arguments for trusting a tap.
func BuildTrustArgs(name string) []string {
	return []string{"trust", name}
}

// greedyFlags maps the configured outdated detection mode to the matching
// brew upgrade flag. Standard mode adds nothing.
func greedyFlags(outdatedFlag string) []string {
	switch outdatedFlag {
	case OutdatedFlagGreedy:
		return []string{"--greedy"}
	case OutdatedFlagGreedyAutoUpdate:
		return []string{"--greedy-auto-updates"}
	default:
		return nil
	}
}

// FormatCommand renders arguments as a copy-pasteable shell command. The plain
// "brew" prefix is used instead of the resolved binary path because the command
// is meant to be pasted into the user's own shell.
func FormatCommand(args []string) string {
	parts := make([]string, 0, len(args)+1)
	parts = append(parts, "brew")
	for _, arg := range args {
		parts = append(parts, quoteArg(arg))
	}
	return strings.Join(parts, " ")
}

// quoteArg single-quotes an argument when it contains characters a shell would
// interpret, so the rendered command stays safe to paste verbatim.
func quoteArg(arg string) string {
	if arg == "" {
		return "''"
	}
	if strings.IndexFunc(arg, needsQuoting) < 0 {
		return arg
	}
	return "'" + strings.ReplaceAll(arg, "'", `'\''`) + "'"
}

func needsQuoting(r rune) bool {
	switch {
	case r >= 'a' && r <= 'z':
		return false
	case r >= 'A' && r <= 'Z':
		return false
	case r >= '0' && r <= '9':
		return false
	}
	return !strings.ContainsRune("-_./:@+=,", r)
}
