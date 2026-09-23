package brew

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestDatabaseUpdateRetriesFailureAndCachesSuccess(t *testing.T) {
	brewPath := filepath.Join(t.TempDir(), "brew")
	brewScript := `#!/bin/sh
printf 'attempt\n' >> "$0.attempts"
if [ ! -f "$0.failed" ]; then
    touch "$0.failed"
    echo 'temporary network failure' >&2
    exit 1
fi
printf 'Updated Homebrew\n'
`
	if err := os.WriteFile(brewPath, []byte(brewScript), 0o755); err != nil {
		t.Fatal(err)
	}

	service := NewDatabaseService(NewExecutor(brewPath, nil, nil))
	if _, err := service.UpdateBrewDatabaseWithOutput(); err == nil || !strings.Contains(err.Error(), "temporary network failure") {
		t.Fatalf("first update error = %v, want network failure", err)
	}
	if err := service.UpdateBrewDatabase(); err == nil || !strings.Contains(err.Error(), "temporary network failure") {
		t.Fatalf("cached failure = %v, want original error", err)
	}
	assertAttempts := func(want int) {
		t.Helper()
		attempts, err := os.ReadFile(brewPath + ".attempts")
		if err != nil {
			t.Fatal(err)
		}
		if got := strings.Count(string(attempts), "attempt\n"); got != want {
			t.Fatalf("brew update executions = %d, want %d", got, want)
		}
	}
	assertAttempts(1)

	service.lastUpdateTime = time.Now().Add(-brewUpdateRetryInterval)
	output, err := service.UpdateBrewDatabaseWithOutput()
	if err != nil || output != "Updated Homebrew\n" {
		t.Fatalf("retry returned (%q, %v), want successful output", output, err)
	}
	assertAttempts(2)

	if err := service.UpdateBrewDatabase(); err != nil {
		t.Fatalf("cached success returned error: %v", err)
	}
	assertAttempts(2)
}
