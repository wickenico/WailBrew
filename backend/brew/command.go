package brew

import (
	"fmt"
	"strings"
	"unicode"
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
// can usually resolve formula vs cask from the token itself, but when a
// formula and a cask share the same name it defaults to the formula, so
// --cask is passed whenever the caller knows the target is a cask.
func BuildInstallArgs(name string, isCask bool) []string {
	args := []string{"install"}
	if isCask {
		args = append(args, "--cask")
	}
	return append(args, name)
}

// BuildUninstallArgs builds the arguments for uninstalling a package. Casks
// always get --cask so a token shared with a formula (or a renamed formula)
// cannot resolve to the formula. --zap is only valid for casks and ignored for
// formulae.
func BuildUninstallArgs(name string, zap, isCask bool) []string {
	args := []string{"uninstall"}
	if isCask {
		if zap {
			args = append(args, "--zap")
		}
		args = append(args, "--cask")
	}
	return append(args, name)
}

// BuildUpgradeArgs builds the arguments for upgrading a single package. Casks
// get --cask because Homebrew treats an ambiguous token as a formula, e.g. the
// onedrive cask resolves to the renamed onedrive-cli formula without it. The
// greedy flags only affect casks; force is used when retrying an upgrade that
// failed because the app already exists.
func BuildUpgradeArgs(name string, isCask bool, outdatedFlag string, force bool) []string {
	args := []string{"upgrade"}
	if isCask {
		args = append(args, "--cask")
		args = append(args, greedyFlags(outdatedFlag)...)
	}
	if force {
		args = append(args, "--force")
	}
	return append(args, name)
}

// BuildUpgradeSelectedArgs builds the arguments for upgrading an explicit list
// of packages of one type. Formulae and casks are upgraded in separate runs so
// the casks can carry --cask. No greedy flag is passed here: casks that need it
// are retried individually via BuildUpgradeArgs.
func BuildUpgradeSelectedArgs(names []string, isCask bool) []string {
	args := []string{"upgrade"}
	if isCask {
		args = append(args, "--cask")
	}
	return append(args, names...)
}

// BuildUpgradeAllArgs builds the arguments for upgrading everything outdated.
// The greedy flags only apply to casks, and Homebrew rejects them together
// with --formula, so they are omitted for formula-only upgrades.
func BuildUpgradeAllArgs(outdatedFlag string, packageType ...string) []string {
	args := []string{"upgrade"}
	kind := ""
	if len(packageType) > 0 {
		kind = packageType[0]
	}
	if kind != "formula" {
		args = append(args, greedyFlags(outdatedFlag)...)
	}
	switch kind {
	case "formula":
		args = append(args, "--formula")
	case "cask":
		args = append(args, "--cask")
	}
	return args
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

// BuildPinArgs builds the arguments for pinning an installed formula or cask
// so brew upgrade skips it.
func BuildPinArgs(name string) []string {
	return []string{"pin", name}
}

// BuildUnpinArgs builds the arguments for unpinning a formula or cask,
// making it eligible for brew upgrade again.
func BuildUnpinArgs(name string) []string {
	return []string{"unpin", name}
}

// BuildAdoptArgs builds the arguments for bringing an app installed outside
// Homebrew under cask management. --adopt keeps the existing bundle and only
// succeeds when its version matches the cask (or the cask auto-updates).
// replace is the fallback for a version mismatch: --force overwrites the app
// bundle with the cask's version. Homebrew rejects combining the two flags.
// User data in ~/Library is untouched either way.
func BuildAdoptArgs(token string, replace bool) []string {
	if replace {
		return []string{"install", "--cask", "--force", token}
	}
	return []string{"install", "--cask", "--adopt", token}
}

// BuildTrustArgs builds the arguments for trusting a tap.
func BuildTrustArgs(name string) []string {
	return []string{"trust", name}
}

// BuildBundleInstallArgs builds the arguments for importing a Brewfile.
// cleanup additionally removes any installed formulae, casks, or taps that
// are not listed in the file, matching the machine to the file exactly.
func BuildBundleInstallArgs(filePath string, cleanup bool) []string {
	args := []string{"bundle", "install", "--file=" + filePath}
	if cleanup {
		args = append(args, "--force-cleanup")
	}
	return args
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

// ParseBrewCommand turns a command printed by Homebrew into brew arguments.
// It deliberately does not invoke a shell: quotes and backslashes are only
// interpreted to preserve arguments, while shell operators remain plain text.
func ParseBrewCommand(command string) ([]string, error) {
	words, err := splitCommandWords(strings.TrimSpace(command))
	if err != nil {
		return nil, err
	}
	if len(words) < 2 || words[0] != "brew" {
		return nil, fmt.Errorf("expected a brew command")
	}
	if brewSubcommandNeedsTarget(words[1]) && len(words) < 3 {
		return nil, fmt.Errorf("brew %s requires a target", words[1])
	}
	return words[1:], nil
}

func brewSubcommandNeedsTarget(subcommand string) bool {
	switch subcommand {
	case "install", "uninstall", "remove", "reinstall", "link", "unlink", "pin", "unpin", "extract":
		return true
	default:
		return false
	}
}

func splitCommandWords(command string) ([]string, error) {
	var words []string
	var current strings.Builder
	var quote rune
	escaped := false
	tokenStarted := false

	flush := func() {
		if tokenStarted {
			words = append(words, current.String())
			current.Reset()
			tokenStarted = false
		}
	}

	for _, r := range command {
		if escaped {
			current.WriteRune(r)
			tokenStarted = true
			escaped = false
			continue
		}

		if quote != 0 {
			if r == quote {
				quote = 0
			} else if r == '\\' && quote == '"' {
				escaped = true
			} else {
				current.WriteRune(r)
			}
			tokenStarted = true
			continue
		}

		switch {
		case r == '\'' || r == '"':
			quote = r
			tokenStarted = true
		case r == '\\':
			escaped = true
			tokenStarted = true
		case unicode.IsSpace(r):
			flush()
		default:
			current.WriteRune(r)
			tokenStarted = true
		}
	}

	if escaped {
		return nil, fmt.Errorf("unfinished escape sequence")
	}
	if quote != 0 {
		return nil, fmt.Errorf("unterminated quote")
	}
	flush()
	return words, nil
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
