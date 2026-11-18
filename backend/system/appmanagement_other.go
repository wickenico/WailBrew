//go:build !darwin
// +build !darwin

package system

// CanModifyAppBundle always succeeds on non-macOS platforms.
func CanModifyAppBundle(appPath string) bool {
	return true
}

// OpenAppManagementSettings is a no-op on non-macOS platforms.
func OpenAppManagementSettings() error {
	return nil
}
