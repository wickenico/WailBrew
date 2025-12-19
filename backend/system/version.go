package system

import (
	"fmt"
	"os/exec"
	"strings"
)

// GetMacOSVersion returns the macOS version using sw_vers command
func GetMacOSVersion() (string, error) {
	cmd := exec.Command("sw_vers", "-productVersion")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get macOS version: %w", err)
	}
	return strings.TrimSpace(string(output)), nil
}
