package brew

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// bumpMtime moves a path's modification time forward so changes are visible
// even on filesystems with coarse timestamp resolution.
func bumpMtime(t *testing.T, path string, offset time.Duration) {
	t.Helper()
	ts := time.Now().Add(offset)
	if err := os.Chtimes(path, ts, ts); err != nil {
		t.Fatal(err)
	}
}

func mkdirAll(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatal(err)
	}
}

func newPrefix(t *testing.T) (prefix string, runner *fakeRunner) {
	t.Helper()
	prefix = t.TempDir()
	mkdirAll(t, filepath.Join(prefix, "Cellar", "wget", "1.21"))
	mkdirAll(t, filepath.Join(prefix, "Caskroom", "firefox", "120.0"))
	runner = &fakeRunner{stdout: map[string]string{
		"--cellar":   filepath.Join(prefix, "Cellar") + "\n",
		"--caskroom": filepath.Join(prefix, "Caskroom") + "\n",
		"--prefix":   prefix + "\n",
	}}
	return prefix, runner
}

// Issue #538: a cask installed or adopted in a terminal must change the
// fingerprint so the UI knows to reload its installed lists.
func TestInstalledStateFingerprint_detectsChangesMadeOutsideWailBrew(t *testing.T) {
	prefix, runner := newPrefix(t)
	svc := NewInstalledStateService(runner)

	base := svc.Fingerprint()
	if base == "" {
		t.Fatal("expected a fingerprint for a readable prefix")
	}
	if again := svc.Fingerprint(); again != base {
		t.Fatalf("fingerprint not stable without changes: %s vs %s", base, again)
	}

	steps := []struct {
		name   string
		change func()
	}{
		{"cask installed", func() {
			mkdirAll(t, filepath.Join(prefix, "Caskroom", "discord", "0.0.300"))
		}},
		{"cask upgraded", func() {
			dir := filepath.Join(prefix, "Caskroom", "firefox")
			mkdirAll(t, filepath.Join(dir, "121.0"))
			bumpMtime(t, dir, time.Hour)
		}},
		{"formula removed", func() {
			if err := os.RemoveAll(filepath.Join(prefix, "Cellar", "wget")); err != nil {
				t.Fatal(err)
			}
		}},
		{"formula pinned", func() {
			mkdirAll(t, filepath.Join(prefix, "var", "homebrew", "pinned"))
		}},
	}

	previous := base
	for _, step := range steps {
		step.change()
		got := svc.Fingerprint()
		if got == previous {
			t.Errorf("%s: fingerprint did not change", step.name)
		}
		previous = got
	}
}

func TestInstalledStateFingerprint_unknownWhenBrewCannotResolvePaths(t *testing.T) {
	runner := &fakeRunner{errs: map[string]error{"--cellar": errors.New("brew not found")}}
	svc := NewInstalledStateService(runner)
	if got := svc.Fingerprint(); got != "" {
		t.Fatalf("expected empty fingerprint, got %q", got)
	}

	// A later success is picked up: failures are not cached.
	_, ok := newPrefix(t)
	runner.errs = nil
	runner.stdout = ok.stdout
	if got := svc.Fingerprint(); got == "" {
		t.Fatal("expected fingerprint once brew resolves paths")
	}
}

func TestInstalledStateFingerprint_missingCaskroomIsNotAnError(t *testing.T) {
	prefix, runner := newPrefix(t)
	if err := os.RemoveAll(filepath.Join(prefix, "Caskroom")); err != nil {
		t.Fatal(err)
	}
	svc := NewInstalledStateService(runner)
	before := svc.Fingerprint()
	if before == "" {
		t.Fatal("expected a fingerprint without a Caskroom")
	}

	// The first cask install creates the Caskroom.
	mkdirAll(t, filepath.Join(prefix, "Caskroom", "slack", "4.41"))
	if svc.Fingerprint() == before {
		t.Fatal("creating the Caskroom did not change the fingerprint")
	}
}
