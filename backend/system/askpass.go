package system

import (
	"fmt"
	"os"
)

// Askpass helper script content for GUI sudo password prompts
const AskpassScript = `#!/bin/bash
# Askpass helper for GUI sudo password prompts
# This script must output the password to stdout and exit with 0 on success, or exit with 1 on failure
password=$(osascript <<'EOF'
try
    display dialog "WailBrew requires administrator privileges to upgrade certain packages. Please enter your password:" default answer "" with icon caution with title "Administrator Password Required" with hidden answer
    set result to text returned of result
    return result
on error
    -- User cancelled or error occurred
    return ""
end try
EOF
)
if [ -z "$password" ]; then
    exit 1
fi
echo -n "$password"
`

// Manager handles askpass helper script creation and cleanup
type Manager struct {
	askpassPath string
}

// NewManager creates a new askpass manager
func NewManager() *Manager {
	return &Manager{}
}

// Setup creates the askpass helper script for GUI sudo prompts
func (m *Manager) Setup() error {
	// Create a temporary directory for the askpass helper
	tempDir := os.TempDir()
	askpassPath := fmt.Sprintf("%s/wailbrew-askpass-%d.sh", tempDir, os.Getpid())

	// Write the askpass script to the temp file
	if err := os.WriteFile(askpassPath, []byte(AskpassScript), 0700); err != nil {
		return fmt.Errorf("failed to create askpass helper: %w", err)
	}

	m.askpassPath = askpassPath
	return nil
}

// Cleanup removes the askpass helper script
func (m *Manager) Cleanup() {
	if m.askpassPath != "" {
		os.Remove(m.askpassPath)
		m.askpassPath = ""
	}
}

// GetPath returns the path to the askpass helper script
func (m *Manager) GetPath() string {
	return m.askpassPath
}
