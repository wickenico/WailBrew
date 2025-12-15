package logging

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

// Manager handles session log management
type Manager struct {
	logs          []string
	mutex         sync.Mutex
	maxLogEntries int
}

// NewManager creates a new session log manager
func NewManager() *Manager {
	return &Manager{
		logs:          make([]string, 0),
		maxLogEntries: 10000,
	}
}

// Append adds a log entry to the session log buffer
// This function is safe to call from any goroutine and will not panic
func (m *Manager) Append(entry string) {
	defer func() {
		// Recover from any panic to ensure logging never crashes the app
		if r := recover(); r != nil {
			// Silently ignore logging errors - logging should never break functionality
			fmt.Fprintf(os.Stderr, "Warning: session log append failed: %v\n", r)
		}
	}()

	m.mutex.Lock()
	defer m.mutex.Unlock()

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logEntry := fmt.Sprintf("[%s] %s", timestamp, entry)
	m.logs = append(m.logs, logEntry)

	// Limit log size to prevent memory issues (keep last maxLogEntries entries)
	if len(m.logs) > m.maxLogEntries {
		m.logs = m.logs[len(m.logs)-m.maxLogEntries:]
	}
}

// Get returns all session logs as a string
func (m *Manager) Get() string {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	return strings.Join(m.logs, "\n")
}

// Clear clears all session logs
func (m *Manager) Clear() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.logs = make([]string, 0)
}
