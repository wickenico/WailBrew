package brew

import (
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
}

func argKey(args ...string) string { return strings.Join(args, " ") }

func (f *fakeRunner) Run(args ...string) ([]byte, error) {
	k := argKey(args...)
	return []byte(f.stderr[k] + f.stdout[k]), nil
}

func (f *fakeRunner) RunStdoutOnly(args ...string) ([]byte, error) {
	return []byte(f.stdout[argKey(args...)]), nil
}

func (f *fakeRunner) RunNoCacheStdoutOnly(args ...string) ([]byte, error) {
	return f.RunStdoutOnly(args...)
}

func (f *fakeRunner) RunWithTimeoutStdoutOnly(_ time.Duration, args ...string) ([]byte, error) {
	return f.RunStdoutOnly(args...)
}

func newTestListService(runner commandRunner, logFunc func(string)) *ListService {
	if logFunc == nil {
		logFunc = func(string) {}
	}
	return NewListService(runner,
		func() error { return nil },
		func() map[string]bool { return map[string]bool{} },
		func() {}, func() {},
		logFunc)
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
