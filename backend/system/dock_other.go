//go:build !darwin
// +build !darwin

package system

// SetDockBadge is a no-op on non-macOS platforms
func SetDockBadge(label string) {
	// No-op on non-macOS platforms
}

// SetDockBadgeCount is a no-op on non-macOS platforms
func SetDockBadgeCount(count int) {
	// No-op on non-macOS platforms
}
