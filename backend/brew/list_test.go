package brew

import "testing"

func TestParseNameListOutput_filtersDiagnosticsAndKeepsNames(t *testing.T) {
	output := []byte(`Warning: The following taps are not trusted:
example/tap

Homebrew is currently ignoring formulae from these taps.

firefox
node
python@3.12
`)

	results := parseNameListOutput(output)
	if len(results) != 4 {
		t.Fatalf("expected 4 names (1 tap line + 3 formulae), got %d: %v", len(results), results)
	}

	if results[1][0] != "firefox" {
		t.Fatalf("expected firefox, got %q", results[1][0])
	}
}

func TestParseNameListOutput_empty(t *testing.T) {
	if results := parseNameListOutput(nil); results != nil {
		t.Fatalf("expected nil for empty output, got %v", results)
	}
}
