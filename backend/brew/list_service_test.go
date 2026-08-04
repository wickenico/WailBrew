package brew

import (
	"errors"
	"strings"
	"testing"
	"time"
)

// fakeRunner mimics *Executor's two capture modes: Run merges stderr into the
// returned bytes (CombinedOutput), RunStdoutOnly does not. Keyed by the joined
// argument list.
type fakeRunner struct {
	stdout map[string]string
	stderr map[string]string
	errs   map[string]error
}

func argKey(args ...string) string { return strings.Join(args, " ") }

func (f *fakeRunner) Run(args ...string) ([]byte, error) {
	k := argKey(args...)
	if err := f.errs[k]; err != nil {
		return nil, err
	}
	return []byte(f.stderr[k] + f.stdout[k]), nil
}

func (f *fakeRunner) RunStdoutOnly(args ...string) ([]byte, error) {
	k := argKey(args...)
	if err := f.errs[k]; err != nil {
		return nil, err
	}
	return []byte(f.stdout[k]), nil
}

func (f *fakeRunner) RunNoCacheStdoutOnly(args ...string) ([]byte, error) {
	return f.RunStdoutOnly(args...)
}

func (f *fakeRunner) RunWithTimeoutStdoutOnly(_ time.Duration, args ...string) ([]byte, error) {
	return f.RunStdoutOnly(args...)
}

// Homebrew writes deprecation warnings from third-party taps to stderr while
// still producing valid JSON on stdout. Reading the install reason through a
// combined-output call puts "Warning: ..." in front of the JSON, so the parse
// fails and every package silently reports its origin as "unknown".
func TestGetBrewPackages_installReasonSurvivesStderrWarnings(t *testing.T) {
	const infoJSON = `{"formulae":[{"name":"wget","installed":[{"installed_on_request":true}]}]}`

	runner := &fakeRunner{
		stdout: map[string]string{
			"list --formula --versions":            "wget 1.21\n",
			"info --json=v2 --formula --installed": infoJSON,
		},
		stderr: map[string]string{
			"info --json=v2 --formula --installed": "Warning: Calling `depends_on :macos` is deprecated!\n",
		},
	}

	service := newTestListService(runner, nil)

	packages := service.GetBrewPackages()

	if len(packages) != 1 {
		t.Fatalf("expected 1 package, got %v", packages)
	}
	if reason := packages[0][3]; reason != "on_request" {
		t.Fatalf("expected install reason %q, got %q", "on_request", reason)
	}
}

func newTestListService(runner commandRunner, logFunc func(string)) *ListService {
	return newTestListServiceWithFailureHook(runner, logFunc, nil)
}

func newTestListServiceWithFailureHook(runner commandRunner, logFunc func(string), onFailure func(string)) *ListService {
	if logFunc == nil {
		logFunc = func(string) {}
	}
	if onFailure == nil {
		onFailure = func(string) {}
	}
	return NewListService(runner,
		func() error { return nil },
		func() map[string]bool { return map[string]bool{} },
		func() {}, func() {},
		logFunc, onFailure)
}

// Homebrew names the untrusted tap and the exact recovery command in its
// diagnostic. Read paths must hand that text to the failure hook so the UI can
// offer the trust action that already exists for install and tap flows.
func TestGetBrewCasks_reportsDiagnosticWhenTapIsUntrusted(t *testing.T) {
	const diagnostic = "exit status 1: Error: Refusing to load cask " +
		"macos-fuse-t/cask/fuse-t-sshfs from untrusted tap macos-fuse-t/cask."

	runner := &fakeRunner{
		errs: map[string]error{"list --cask --versions": errors.New(diagnostic)},
	}

	var reported []string
	service := newTestListServiceWithFailureHook(runner, nil, func(stderr string) {
		reported = append(reported, stderr)
	})

	service.GetBrewCasks()

	if len(reported) != 1 {
		t.Fatalf("expected the failure diagnostic to be reported once, got %d", len(reported))
	}
	if tap, ok := TrustRemedy(Capabilities{SupportsTrust: true}, reported[0]); !ok || tap != "macos-fuse-t/cask" {
		t.Fatalf("reported diagnostic did not yield the untrusted tap: %q", reported[0])
	}
}

// A malformed install-reason payload silently degrades every package to
// "unknown". Swallowing the parse error leaves no trace of why, so the failure
// must reach the session log.
func TestGetBrewPackages_logsWhenInstallReasonJSONIsUnreadable(t *testing.T) {
	runner := &fakeRunner{
		stdout: map[string]string{
			"list --formula --versions":            "wget 1.21\n",
			"info --json=v2 --formula --installed": "this is not json",
		},
	}

	var logged []string
	service := newTestListService(runner, func(msg string) { logged = append(logged, msg) })

	service.GetBrewPackages()

	if len(logged) == 0 {
		t.Fatal("expected a log entry when the install-reason JSON could not be parsed")
	}
}
