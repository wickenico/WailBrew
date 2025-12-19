package system

import (
	"fmt"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// macOS release names mapped to major version numbers
var macOSReleaseNames = map[int]string{
	10: "Catalina",
	11: "Big Sur",
	12: "Monterey",
	13: "Ventura",
	14: "Sonoma",
	15: "Sequoia",
	26: "Tahoe",
}

// GetMacOSVersion returns the macOS version using sw_vers command
func GetMacOSVersion() (string, error) {
	cmd := exec.Command("sw_vers", "-productVersion")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get macOS version: %w", err)
	}
	return strings.TrimSpace(string(output)), nil
}

// GetMacOSReleaseName returns the macOS release name (e.g., "Sonoma", "Sequoia") based on version number
func GetMacOSReleaseName() (string, error) {
	version, err := GetMacOSVersion()
	if err != nil {
		return "", err
	}

	// Parse version number (e.g., "14.2.1" -> major version 14)
	parts := strings.Split(version, ".")
	if len(parts) == 0 {
		return "", fmt.Errorf("invalid version format: %s", version)
	}

	majorVersion, err := strconv.Atoi(parts[0])
	if err != nil {
		return "", fmt.Errorf("failed to parse major version: %w", err)
	}

	// Look up release name
	if releaseName, exists := macOSReleaseNames[majorVersion]; exists {
		return releaseName, nil
	}

	// Return empty string if version not found (will be handled gracefully in UI)
	return "", nil
}

// GetSystemArchitecture returns the system architecture
func GetSystemArchitecture() string {
	return runtime.GOARCH
}
