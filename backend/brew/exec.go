package brew

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"time"
)

// Executor handles brew command execution
type Executor struct {
	brewPath    string
	brewEnv     []string
	logCallback func(string)
}

// NewExecutor creates a new brew executor
func NewExecutor(brewPath string, brewEnv []string, logCallback func(string)) *Executor {
	return &Executor{
		brewPath:    brewPath,
		brewEnv:     brewEnv,
		logCallback: logCallback,
	}
}

// Run executes a brew command and returns output and error
func (e *Executor) Run(args ...string) ([]byte, error) {
	return e.RunWithTimeout(30*time.Second, args...)
}

// RunWithTimeout executes a brew command with a timeout
func (e *Executor) RunWithTimeout(timeout time.Duration, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmdStr := fmt.Sprintf("brew %s", joinArgs(args))
	// Log command start asynchronously to avoid blocking
	if e.logCallback != nil {
		go e.logCallback(fmt.Sprintf("Executing: %s", cmdStr))
	}

	cmd := exec.CommandContext(ctx, e.brewPath, args...)
	cmd.Env = append(os.Environ(), e.brewEnv...)

	output, err := cmd.CombinedOutput()

	// Check if the error was due to timeout
	if ctx.Err() == context.DeadlineExceeded {
		errorMsg := fmt.Sprintf("Command timed out after %v: brew %v", timeout, args)
		if e.logCallback != nil {
			go e.logCallback(fmt.Sprintf("ERROR: %s", errorMsg))
		}
		return nil, fmt.Errorf("command timed out after %v: brew %v", timeout, args)
	}

	// Log result asynchronously (non-blocking, won't affect command execution)
	if e.logCallback != nil {
		if err != nil {
			outputStr := string(output)
			if len(outputStr) > 500 {
				outputStr = outputStr[:500] + "... (truncated)"
			}
			go e.logCallback(fmt.Sprintf("ERROR: %s failed: %v\nOutput: %s", cmdStr, err, outputStr))
		} else {
			go e.logCallback(fmt.Sprintf("SUCCESS: %s completed", cmdStr))
		}
	}

	return output, err
}

// ValidateInstallation checks if brew is working properly
func (e *Executor) ValidateInstallation() error {
	// First check if brew executable exists
	if _, err := os.Stat(e.brewPath); os.IsNotExist(err) {
		return fmt.Errorf("brew not found at path: %s", e.brewPath)
	}

	// Try running a simple brew command to verify it works
	_, err := e.Run("--version")
	if err != nil {
		return fmt.Errorf("brew is not working properly: %v", err)
	}

	return nil
}

// joinArgs joins command arguments (helper function)
func joinArgs(args []string) string {
	if len(args) == 0 {
		return ""
	}
	result := args[0]
	for i := 1; i < len(args); i++ {
		result += " " + args[i]
	}
	return result
}
