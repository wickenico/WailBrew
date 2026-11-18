//go:build darwin

package system

import (
	"os"
	"path/filepath"
	"testing"
)

// A bundle this process created itself is not protected by App Management,
// and a missing Info.plist must not be reported as a denial.
func TestCanModifyAppBundle(t *testing.T) {
	app := filepath.Join(t.TempDir(), "Fresh.app")
	if err := os.MkdirAll(filepath.Join(app, "Contents"), 0o755); err != nil {
		t.Fatal(err)
	}
	if !CanModifyAppBundle(app) {
		t.Error("missing Info.plist reported as denied")
	}
	if err := os.WriteFile(filepath.Join(app, "Contents", "Info.plist"), []byte("<plist/>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if !CanModifyAppBundle(app) {
		t.Error("own bundle reported as denied")
	}
}
