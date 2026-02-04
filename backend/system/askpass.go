package system

import (
	"fmt"
	"os"
	"strings"
)

// Askpass helper script content for GUI sudo password prompts
// Two-stage dialog: username then password
const AskpassScript = `#!/bin/bash
# Askpass helper for GUI sudo password prompts
# Two-stage dialog: username then password
# This script must output the password to stdout and exit with 0 on success, or exit with 1 on failure

# Stage 1: Get username (with default from config)
username=$(osascript <<'EOF'
try
    display dialog "Enter admin username for privileged operations:" default answer "DEFAULT_USERNAME" with icon caution with title "Admin Credentials Required"
    set result to text returned of result
    return result
on error
    return ""
end try
EOF
)

if [ -z "$username" ]; then
    exit 1
fi

# Store username temporarily for later use
echo "$username" > /tmp/wailbrew-sudo-user-$$.tmp

# Stage 2: Get password for that username
password=$(osascript <<EOF
try
    display dialog "Enter password for user '$username':" default answer "" with icon caution with title "Admin Password Required" with hidden answer
    set result to text returned of result
    return result
on error
    return ""
end try
EOF
)

if [ -z "$password" ]; then
    rm -f /tmp/wailbrew-sudo-user-$$.tmp
    exit 1
fi

# Return password (SUDO_ASKPASS requirement)
echo -n "$password"
`

// Manager handles askpass helper script creation and cleanup
type Manager struct {
	askpassPath     string
	defaultUsername string // Default username to show in dialog
}

// NewManager creates a new askpass manager
func NewManager(defaultUsername string) *Manager {
	return &Manager{
		defaultUsername: defaultUsername,
	}
}

// Setup creates the askpass helper script for GUI sudo prompts
func (m *Manager) Setup() error {
	// Replace DEFAULT_USERNAME placeholder in script
	script := strings.Replace(AskpassScript, "DEFAULT_USERNAME", m.defaultUsername, 1)

	// Create a temporary directory for the askpass helper
	tempDir := os.TempDir()
	askpassPath := fmt.Sprintf("%s/wailbrew-askpass-%d.sh", tempDir, os.Getpid())

	// Write the askpass script to the temp file
	if err := os.WriteFile(askpassPath, []byte(script), 0700); err != nil {
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
	// Clean up temporary username file
	tmpFile := fmt.Sprintf("/tmp/wailbrew-sudo-user-%d.tmp", os.Getpid())
	os.Remove(tmpFile)
}

// GetPath returns the path to the askpass helper script
func (m *Manager) GetPath() string {
	return m.askpassPath
}

// GetCapturedUsername reads the username captured by the askpass dialog
func (m *Manager) GetCapturedUsername() string {
	// Read from temp file created by askpass script
	tmpFile := fmt.Sprintf("/tmp/wailbrew-sudo-user-%d.tmp", os.Getpid())
	data, err := os.ReadFile(tmpFile)
	if err != nil {
		return "" // Fall back to current user
	}
	return strings.TrimSpace(string(data))
}
