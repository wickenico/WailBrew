package brew

import (
	"errors"
	"testing"
	"time"
)

// countingRunner records how many times a command was executed and reports a
// canned failure for commands listed in failing.
type countingRunner struct {
	calls   int
	failing map[string]bool
}

func (c *countingRunner) Run(args ...string) ([]byte, error) {
	c.calls++
	if c.failing[argKey(args...)] {
		return nil, errors.New("Error: Unknown command: trust")
	}
	return nil, nil
}

func (c *countingRunner) RunStdoutOnly(args ...string) ([]byte, error) { return c.Run(args...) }
func (c *countingRunner) RunNoCacheStdoutOnly(args ...string) ([]byte, error) {
	return c.Run(args...)
}
func (c *countingRunner) RunWithTimeoutStdoutOnly(_ time.Duration, args ...string) ([]byte, error) {
	return c.Run(args...)
}

// `brew help trust` exits 0 where the command exists and non-zero where it does
// not. Trust shipped in Homebrew 5.1.15, so neither the major version nor the
// full version string is a usable signal — dev builds and Workbrew both lie.
func TestCapabilityDetector_detectsTrustSupport(t *testing.T) {
	supported := NewCapabilityDetector(&countingRunner{})
	if !supported.Capabilities().SupportsTrust {
		t.Fatal("expected trust to be supported when `brew help trust` succeeds")
	}

	missing := NewCapabilityDetector(&countingRunner{failing: map[string]bool{"help trust": true}})
	if missing.Capabilities().SupportsTrust {
		t.Fatal("expected trust to be unsupported when `brew help trust` fails")
	}
}

// The probe spawns Ruby and costs ~300ms, so it must happen at most once.
func TestCapabilityDetector_probesOnce(t *testing.T) {
	runner := &countingRunner{}
	detector := NewCapabilityDetector(runner)

	for i := 0; i < 5; i++ {
		detector.Capabilities()
	}

	if runner.calls != 1 {
		t.Fatalf("expected the capability probe to run once, ran %d times", runner.calls)
	}
}

func TestTrustRemedy_offersTapWhenSupported(t *testing.T) {
	stderr := "Error: Refusing to load cask macos-fuse-t/cask/fuse-t-sshfs from untrusted tap macos-fuse-t/cask."

	tap, ok := TrustRemedy(Capabilities{SupportsTrust: true}, stderr)

	if !ok {
		t.Fatal("expected a trust remedy to be offered")
	}
	if tap != "macos-fuse-t/cask" {
		t.Fatalf("expected tap %q, got %q", "macos-fuse-t/cask", tap)
	}
}

// On Homebrew older than 5.1.15 the `brew trust` command does not exist, so
// offering the remedy would hand the user a command that cannot work.
func TestTrustRemedy_suppressedWhenTrustUnsupported(t *testing.T) {
	stderr := "Error: Refusing to load cask macos-fuse-t/cask/fuse-t-sshfs from untrusted tap macos-fuse-t/cask."

	if _, ok := TrustRemedy(Capabilities{SupportsTrust: false}, stderr); ok {
		t.Fatal("expected no trust remedy when brew trust is unavailable")
	}
}

func TestTrustRemedy_ignoresUnrelatedFailures(t *testing.T) {
	if _, ok := TrustRemedy(Capabilities{SupportsTrust: true}, "Error: No such keg: /opt/homebrew/Cellar/wget"); ok {
		t.Fatal("expected no trust remedy for an unrelated failure")
	}
}
