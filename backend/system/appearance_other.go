//go:build !darwin
// +build !darwin

package system

// SetAppearanceDark is a no-op on non-macOS platforms
func SetAppearanceDark() {
	// No-op on non-macOS platforms
}

// SetAppearanceLight is a no-op on non-macOS platforms
func SetAppearanceLight() {
	// No-op on non-macOS platforms
}
