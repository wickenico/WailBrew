//go:build darwin
// +build darwin

package system

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// appManagementSettingsURL opens System Settings › Privacy & Security ›
// App Management.
const appManagementSettingsURL = "x-apple.systempreferences:com.apple.preference.security?Privacy_AppBundles"

// CanModifyAppBundle reports whether macOS lets this process (and therefore
// the brew commands it starts) change an existing app bundle.
//
// Since macOS 13, the "App Management" privacy setting protects apps that
// have been launched before: changing them fails with EPERM, even for the
// owner, until the responsible app is allowed under Privacy & Security ›
// App Management. Homebrew changes permissions and group of an app after
// adopting it, so adoption fails without that permission.
//
// The probe re-applies the file's current group to Contents/Info.plist, which
// changes nothing but goes through the same check. Errors other than EPERM
// (e.g. a missing Info.plist) are not treated as a denial.
func CanModifyAppBundle(appPath string) bool {
	probe := filepath.Join(appPath, "Contents", "Info.plist")
	info, err := os.Lstat(probe)
	if err != nil {
		return true
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return true
	}
	err = os.Lchown(probe, -1, int(stat.Gid))
	return !errors.Is(err, syscall.EPERM)
}

// OpenAppManagementSettings opens the App Management privacy settings.
func OpenAppManagementSettings() error {
	return exec.Command("/usr/bin/open", appManagementSettingsURL).Run()
}
