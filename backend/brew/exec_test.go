package brew

import (
	"errors"
	"os/exec"
	"strings"
	"testing"
)

// failingBrew returns a real *exec.ExitError whose Stderr is populated, matching
// what cmd.Output() produces when brew exits non-zero.
func failingBrew(t *testing.T, stderr string) error {
	t.Helper()
	_, err := exec.Command("/usr/bin/false").Output()
	var exitErr *exec.ExitError
	if !errors.As(err, &exitErr) {
		t.Fatalf("expected the helper command to fail with *exec.ExitError, got %v", err)
	}
	exitErr.Stderr = []byte(stderr)
	return exitErr
}

// Homebrew explains exactly how to recover from an untrusted tap, but cmd.Output()
// puts that text on ExitError.Stderr, which formats as a bare "exit status 1".
// Callers render errors with %v, so the actionable message must be in Error().
func TestWithCommandStderr_surfacesBrewDiagnostics(t *testing.T) {
	err := failingBrew(t, "Error: Refusing to load cask from untrusted tap example/cask.")

	got := withCommandStderr(err, nil).Error()

	if !strings.Contains(got, "Refusing to load cask") {
		t.Fatalf("expected brew stderr in the error message, got %q", got)
	}
}

func TestWithCommandStderr_preservesUnwrapping(t *testing.T) {
	err := failingBrew(t, "boom")

	var exitErr *exec.ExitError
	if !errors.As(withCommandStderr(err, nil), &exitErr) {
		t.Fatal("expected the wrapped error to still unwrap to *exec.ExitError")
	}
}

func TestWithCommandStderr_nilStaysNil(t *testing.T) {
	if got := withCommandStderr(nil, nil); got != nil {
		t.Fatalf("expected nil error to stay nil, got %v", got)
	}
}

func TestWithCommandStderr_fallsBackToStdout(t *testing.T) {
	err := failingBrew(t, "")

	got := withCommandStderr(err, []byte("Error: some stdout diagnostic")).Error()

	if !strings.Contains(got, "some stdout diagnostic") {
		t.Fatalf("expected stdout fallback in the error message, got %q", got)
	}
}
