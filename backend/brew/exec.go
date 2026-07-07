package brew

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// cacheEntry holds a cached command result
type cacheEntry struct {
	output    []byte
	err       error
	expiresAt time.Time
}

// Executor handles brew command execution with result caching
type Executor struct {
	brewPath    string
	brewEnv     []string
	logCallback func(string)

	// Command result cache (short-lived to deduplicate parallel calls)
	cache    map[string]*cacheEntry
	cacheMux sync.RWMutex
	cacheTTL time.Duration

	// Validation cache (long-lived, only needs to succeed once)
	validated   bool
	validateMux sync.Mutex
}

// NewExecutor creates a new brew executor with caching
func NewExecutor(brewPath string, brewEnv []string, logCallback func(string)) *Executor {
	return &Executor{
		brewPath:    brewPath,
		brewEnv:     brewEnv,
		logCallback: logCallback,
		cache:       make(map[string]*cacheEntry),
		cacheTTL:    10 * time.Second, // Short TTL to deduplicate parallel startup calls
	}
}

// ClearCache clears the command result cache
func (e *Executor) ClearCache() {
	e.cacheMux.Lock()
	defer e.cacheMux.Unlock()
	e.cache = make(map[string]*cacheEntry)
}

// Run executes a brew command and returns output and error (with caching)
func (e *Executor) Run(args ...string) ([]byte, error) {
	return e.runWithTimeout(30*time.Second, false, args...)
}

// RunWithTimeout executes a brew command with a timeout (with caching)
func (e *Executor) RunWithTimeout(timeout time.Duration, args ...string) ([]byte, error) {
	return e.runWithTimeout(timeout, false, args...)
}

// RunStdoutOnly executes a brew command and returns stdout only (with caching).
// Use this for name-list commands (formulae, casks, tap, leaves) so Homebrew 6
// diagnostic output on stderr is not merged into the parsed result.
func (e *Executor) RunStdoutOnly(args ...string) ([]byte, error) {
	return e.runWithTimeout(30*time.Second, true, args...)
}

// RunWithTimeoutStdoutOnly executes a brew command with stdout-only capture.
func (e *Executor) RunWithTimeoutStdoutOnly(timeout time.Duration, args ...string) ([]byte, error) {
	return e.runWithTimeout(timeout, true, args...)
}

// RunNoCache executes a brew command without using the cache
// Use this for commands that modify state (install, remove, update, etc.)
func (e *Executor) RunNoCache(args ...string) ([]byte, error) {
	return e.runActual(30*time.Second, false, args...)
}

// RunNoCacheStdoutOnly executes a brew command without cache, stdout only.
func (e *Executor) RunNoCacheStdoutOnly(args ...string) ([]byte, error) {
	return e.runActual(30*time.Second, true, args...)
}

func (e *Executor) runWithTimeout(timeout time.Duration, stdoutOnly bool, args ...string) ([]byte, error) {
	cacheKey := strings.Join(args, "\x00") // Use null byte separator for unique key
	if stdoutOnly {
		cacheKey = "stdout\x00" + cacheKey
	}

	// Check cache first (read lock)
	e.cacheMux.RLock()
	if entry, ok := e.cache[cacheKey]; ok && time.Now().Before(entry.expiresAt) {
		e.cacheMux.RUnlock()
		// Log cache hit
		if e.logCallback != nil {
			cmdStr := fmt.Sprintf("brew %s", joinArgs(args))
			go e.logCallback(fmt.Sprintf("CACHE HIT: %s", cmdStr))
		}
		return entry.output, entry.err
	}
	e.cacheMux.RUnlock()

	// Execute the command
	output, err := e.runActual(timeout, stdoutOnly, args...)

	// Cache successful results only so transient failures (e.g. timeouts) can be retried
	if err == nil {
		e.cacheMux.Lock()
		e.cache[cacheKey] = &cacheEntry{
			output:    output,
			err:       err,
			expiresAt: time.Now().Add(e.cacheTTL),
		}
		e.cacheMux.Unlock()
	}

	return output, err
}

// runActual performs the actual command execution
func (e *Executor) runActual(timeout time.Duration, stdoutOnly bool, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmdStr := fmt.Sprintf("brew %s", joinArgs(args))
	// Log command start asynchronously to avoid blocking
	if e.logCallback != nil {
		go e.logCallback(fmt.Sprintf("Executing: %s", cmdStr))
	}

	cmd := exec.CommandContext(ctx, e.brewPath, args...)
	cmd.Env = append(os.Environ(), e.brewEnv...)

	var output []byte
	var err error
	if stdoutOnly {
		output, err = cmd.Output()
	} else {
		output, err = cmd.CombinedOutput()
	}

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
			outputStr := brewCommandErrorOutput(output, err)
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

func brewCommandErrorOutput(stdout []byte, err error) string {
	if exitErr, ok := err.(*exec.ExitError); ok && len(exitErr.Stderr) > 0 {
		return string(exitErr.Stderr)
	}
	return string(stdout)
}

// ValidateInstallation checks if brew is working properly (cached after first success)
func (e *Executor) ValidateInstallation() error {
	e.validateMux.Lock()
	defer e.validateMux.Unlock()

	// If already validated successfully, return immediately
	if e.validated {
		return nil
	}

	// First check if brew executable exists
	if _, err := os.Stat(e.brewPath); os.IsNotExist(err) {
		return fmt.Errorf("brew not found at path: %s", e.brewPath)
	}

	// Try running a simple brew command to verify it works
	_, err := e.Run("--version")
	if err != nil {
		return fmt.Errorf("brew is not working properly: %v", err)
	}

	// Mark as validated so we don't repeat this check
	e.validated = true
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
