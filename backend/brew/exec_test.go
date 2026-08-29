package brew

import (
	"errors"
	"os/exec"
	"strings"
	"sync"
	"sync/atomic"
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

func TestExecutor_resolvesEnvironmentLazily(t *testing.T) {
	var resolutions atomic.Int32
	executor := NewExecutorWithEnvProvider("/usr/bin/printf", func() []string {
		resolutions.Add(1)
		return nil
	}, nil)

	if got := resolutions.Load(); got != 0 {
		t.Fatalf("environment resolved during construction: got %d resolutions", got)
	}

	output, err := executor.Run("ready")
	if err != nil {
		t.Fatalf("executor.Run() error = %v", err)
	}
	if got := string(output); got != "ready" {
		t.Fatalf("executor.Run() output = %q, want %q", got, "ready")
	}
	if got := resolutions.Load(); got != 1 {
		t.Fatalf("environment resolutions = %d, want 1", got)
	}
}

func TestExecutor_deduplicatesConcurrentCommands(t *testing.T) {
	const callers = 8

	var executions atomic.Int32
	executor := NewExecutorWithEnvProvider("/bin/sh", func() []string {
		executions.Add(1)
		return nil
	}, nil)

	start := make(chan struct{})
	results := make(chan string, callers)
	errors := make(chan error, callers)
	var wg sync.WaitGroup
	for range callers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			output, err := executor.Run("-c", "sleep 0.1; printf shared")
			results <- string(output)
			errors <- err
		}()
	}

	close(start)
	wg.Wait()
	close(results)
	close(errors)

	for err := range errors {
		if err != nil {
			t.Fatalf("executor.Run() error = %v", err)
		}
	}
	for output := range results {
		if output != "shared" {
			t.Fatalf("executor.Run() output = %q, want %q", output, "shared")
		}
	}
	if got := executions.Load(); got != 1 {
		t.Fatalf("actual executions = %d, want 1", got)
	}
}
