package brew

import "testing"

// homebrew-core and homebrew-cask shard their Formula/ and Casks/ directories
// by the package's first character (e.g. Formula/j/jq.rb, Casks/w/wailbrew.rb)
// to keep the directory listing manageable. Any tap can do the same for large
// enough collections. ParseWarnings must key its result by the plain package
// name in either layout so callers can look it up with the name brew itself
// reports (e.g. from `brew outdated --json=v2`).

func TestParseWarnings_shardedFormulaPath(t *testing.T) {
	warnings := "/opt/homebrew/Library/Taps/homebrew/homebrew-core/Formula/j/jq.rb:24: warning: instance variable @build_bottle not initialized\n"

	result := ParseWarnings(warnings)

	if _, found := result["jq"]; !found {
		t.Fatalf("expected warning keyed by plain package name %q, got keys %v", "jq", keysOf(result))
	}
	if _, found := result["j/jq"]; found {
		t.Fatalf("warning incorrectly keyed by shard-prefixed name %q, keys %v", "j/jq", keysOf(result))
	}
}

func TestParseWarnings_shardedCaskPath(t *testing.T) {
	warnings := "/opt/homebrew/Library/Taps/homebrew/homebrew-cask/Casks/w/wailbrew.rb:3: warning: something happened\n"

	result := ParseWarnings(warnings)

	if _, found := result["wailbrew"]; !found {
		t.Fatalf("expected warning keyed by plain package name %q, got keys %v", "wailbrew", keysOf(result))
	}
}

func TestParseWarnings_flatTapPathStillWorks(t *testing.T) {
	// Smaller third-party taps are not sharded, e.g. Formula/supabase.rb directly.
	warnings := "/opt/homebrew/Library/Taps/supabase/homebrew-tap/Formula/supabase.rb:5: warning: deprecated call\n"

	result := ParseWarnings(warnings)

	if _, found := result["supabase"]; !found {
		t.Fatalf("expected warning keyed by plain package name %q, got keys %v", "supabase", keysOf(result))
	}
}

func TestParseWarnings_multiplePackagesEachGetTheirOwnWarning(t *testing.T) {
	warnings := "" +
		"/opt/homebrew/Library/Taps/homebrew/homebrew-core/Formula/a/aws-sdk-cpp.rb:1: warning: first\n" +
		"/opt/homebrew/Library/Taps/homebrew/homebrew-core/Formula/j/jq.rb:2: warning: second\n"

	result := ParseWarnings(warnings)

	if v := result["aws-sdk-cpp"]; v == "" {
		t.Fatalf("expected a warning for aws-sdk-cpp, keys %v", keysOf(result))
	}
	if v := result["jq"]; v == "" {
		t.Fatalf("expected a warning for jq, keys %v", keysOf(result))
	}
}

func TestParseWarnings_emptyInput(t *testing.T) {
	if result := ParseWarnings(""); len(result) != 0 {
		t.Fatalf("expected empty map for empty input, got %v", result)
	}
}

func keysOf(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
