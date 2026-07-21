//go:build darwin
// +build darwin

package system

import (
	"encoding/json"
	"testing"
)

// buildArtifactJSON is a helper that serialises a casks array from raw artifact
// maps so tests don't have to hand-craft JSON strings.
func buildArtifactJSON(t *testing.T, artifacts ...map[string]interface{}) []byte {
	t.Helper()
	type cask struct {
		Token     string                   `json:"token"`
		Artifacts []map[string]interface{} `json:"artifacts"`
	}
	data, err := json.Marshal(map[string]interface{}{
		"casks": []cask{{Token: "testcask", Artifacts: artifacts}},
	})
	if err != nil {
		t.Fatalf("buildArtifactJSON: %v", err)
	}
	return data
}

func TestParseCaskArtifacts_AppAbsolutePath(t *testing.T) {
	raw := buildArtifactJSON(t, map[string]interface{}{
		"app": []interface{}{"/Applications/MyApp.app"},
	})
	got, isPkg, err := parseCaskArtifacts(raw, "/Applications")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if isPkg {
		t.Fatal("expected isPkg=false")
	}
	if got != "/Applications/MyApp.app" {
		t.Fatalf("expected /Applications/MyApp.app, got %q", got)
	}
}

func TestParseCaskArtifacts_AppBareName(t *testing.T) {
	raw := buildArtifactJSON(t, map[string]interface{}{
		"app": []interface{}{"Firefox.app"},
	})
	got, isPkg, err := parseCaskArtifacts(raw, "/Applications")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if isPkg {
		t.Fatal("expected isPkg=false")
	}
	if got != "/Applications/Firefox.app" {
		t.Fatalf("expected /Applications/Firefox.app, got %q", got)
	}
}

func TestParseCaskArtifacts_PkgOnly(t *testing.T) {
	raw := buildArtifactJSON(t, map[string]interface{}{
		"pkg": []interface{}{"Installer.pkg"},
	})
	_, isPkg, err := parseCaskArtifacts(raw, "/Applications")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !isPkg {
		t.Fatal("expected isPkg=true for pkg-only cask")
	}
}

func TestParseCaskArtifacts_AppTakesPrecedenceOverPkg(t *testing.T) {
	raw := buildArtifactJSON(t,
		map[string]interface{}{"pkg": []interface{}{"Something.pkg"}},
		map[string]interface{}{"app": []interface{}{"TheApp.app"}},
	)
	got, isPkg, err := parseCaskArtifacts(raw, "/Applications")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if isPkg {
		t.Fatal("expected isPkg=false when app artifact present")
	}
	if got != "/Applications/TheApp.app" {
		t.Fatalf("expected /Applications/TheApp.app, got %q", got)
	}
}

func TestParseCaskArtifacts_NoUsefulArtifact(t *testing.T) {
	// An artifact list with only string entries (e.g. "zap") — no app or pkg map
	data, _ := json.Marshal(map[string]interface{}{
		"casks": []map[string]interface{}{{
			"token":     "testcask",
			"artifacts": []interface{}{"zap"},
		}},
	})
	_, _, err := parseCaskArtifacts(data, "/Applications")
	if err == nil {
		t.Fatal("expected an error for a cask with no app/pkg artifact")
	}
}

func TestParseCaskArtifacts_EmptyCasks(t *testing.T) {
	data, _ := json.Marshal(map[string]interface{}{"casks": []interface{}{}})
	_, _, err := parseCaskArtifacts(data, "/Applications")
	if err == nil {
		t.Fatal("expected an error for empty casks array")
	}
}

func TestParseCaskArtifacts_LeadingWarning(t *testing.T) {
	// Simulate Homebrew emitting a warning line before the JSON
	warning := []byte("Warning: some-tap is not trusted\n")
	jsonPart := buildArtifactJSON(t, map[string]interface{}{
		"app": []interface{}{"WarningApp.app"},
	})
	combined := append(warning, jsonPart...)
	got, _, err := parseCaskArtifacts(combined, "/Applications")
	if err != nil {
		t.Fatalf("unexpected error with leading warning: %v", err)
	}
	if got != "/Applications/WarningApp.app" {
		t.Fatalf("expected /Applications/WarningApp.app, got %q", got)
	}
}

func TestAppNameFromPath(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"/Applications/Firefox.app", "Firefox"},
		{"/Applications/Visual Studio Code.app", "Visual Studio Code"},
		{"Bare.app", "Bare"},
		{"/Applications/NoExt", "NoExt"},
	}
	for _, tc := range cases {
		got := AppNameFromPath(tc.input)
		if got != tc.want {
			t.Errorf("AppNameFromPath(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}
