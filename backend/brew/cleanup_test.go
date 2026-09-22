package brew

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCleanupRefreshesEstimateImmediately(t *testing.T) {
	dir := t.TempDir()
	brewPath := filepath.Join(dir, "brew")
	// Simulate removable files appearing again between cleanup runs.
	script := `#!/bin/sh
state="$(dirname "$0")/removable"
if [ "$2" = "--dry-run" ]; then
    if [ -f "$state" ]; then
        echo '==> This operation would free approximately 137.4MB of disk space.'
    fi
else
    rm -f "$state"
    echo '==> This operation has freed approximately 137.4MB of disk space.'
fi
`
	if err := os.WriteFile(brewPath, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	s := &serviceImpl{executor: NewExecutor(brewPath, nil, nil)}
	for range 2 {
		if err := os.WriteFile(filepath.Join(dir, "removable"), nil, 0600); err != nil {
			t.Fatal(err)
		}
		if estimate, err := s.GetBrewCleanupDryRun(); err != nil || estimate != "137.4MB" {
			t.Fatalf("before cleanup: estimate = %q, error = %v", estimate, err)
		}
		if output := s.RunBrewCleanupDryRun(); !strings.Contains(output, "137.4MB") {
			t.Fatalf("before cleanup: dry run = %q", output)
		}
		if output := s.RunBrewCleanup(); !strings.Contains(output, "has freed") {
			t.Fatalf("cleanup = %q", output)
		}
		if estimate, err := s.GetBrewCleanupDryRun(); err != nil || estimate != "0B" {
			t.Fatalf("after cleanup: estimate = %q, error = %v", estimate, err)
		}
		if output := s.RunBrewCleanupDryRun(); output != "" {
			t.Fatalf("after cleanup: dry run = %q", output)
		}
	}
}
