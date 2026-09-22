//go:build !darwin
// +build !darwin

package system

import "fmt"

// CaskIconDataURL is unavailable outside macOS app bundles.
func CaskIconDataURL(appPath string) (string, error) {
	return "", fmt.Errorf("cask app icons are only available on macOS")
}

// ResolveCaskAppPath is a no-op on non-macOS platforms.
func ResolveCaskAppPath(brewPath, caskName, appDir string) (appPath string, isPkg bool, err error) {
	return "", false, nil
}

// AppNameFromPath is a no-op on non-macOS platforms.
func AppNameFromPath(appPath string) string {
	return ""
}

// IsAppRunning is a no-op on non-macOS platforms.
func IsAppRunning(appName string) bool {
	return false
}

// QuitAppGracefully is a no-op on non-macOS platforms.
func QuitAppGracefully(appName string) error {
	return nil
}

// RemoveQuarantine is a no-op on non-macOS platforms.
func RemoveQuarantine(appPath string) error {
	return nil
}

// LaunchApp is a no-op on non-macOS platforms.
func LaunchApp(appPath string) error {
	return nil
}
