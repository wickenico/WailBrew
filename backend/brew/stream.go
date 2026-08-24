package brew

import (
	"bufio"
	"fmt"
	"os/exec"
	"strings"
	"sync"
)

// streamPhase identifies which step of a streaming command failed, so
// callers can select the right localized error message. phaseNone means the
// command completed successfully.
type streamPhase int

const (
	phaseNone streamPhase = iota
	phaseStdoutPipe
	phaseStderrPipe
	phaseStart
	phaseRun
)

// runStreamingCommand starts cmd and streams its stdout/stderr line-by-line to
// onStdout/onStderr (invoked with trimmed, non-empty lines) until the command
// exits and all output has been drained. The scanner goroutines are always
// waited on before cmd.Wait() is called, so a "complete" event fired by the
// caller right after this returns is guaranteed to follow every progress
// line that was emitted.
//
// It returns the phase at which anything went wrong (phaseNone on success),
// the full captured stderr text (trimmed lines, newline-joined) for callers
// that need to inspect it for known error patterns (e.g. "app already
// exists", "untrusted tap"), and the underlying error.
func runStreamingCommand(cmd *exec.Cmd, onStdout, onStderr func(line string)) (phase streamPhase, stderrText string, err error) {
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return phaseStdoutPipe, "", err
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return phaseStderrPipe, "", err
	}

	if err := cmd.Start(); err != nil {
		return phaseStart, "", err
	}

	var stderrOutput strings.Builder
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			if line := strings.TrimSpace(scanner.Text()); line != "" && onStdout != nil {
				onStdout(line)
			}
		}
	}()

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" {
				continue
			}
			stderrOutput.WriteString(line)
			stderrOutput.WriteString("\n")
			if onStderr != nil {
				onStderr(line)
			}
		}
	}()

	// Wait for scanners to drain before calling cmd.Wait().
	wg.Wait()
	if waitErr := cmd.Wait(); waitErr != nil {
		return phaseRun, stderrOutput.String(), waitErr
	}
	return phaseNone, stderrOutput.String(), nil
}

// runStreamingCommandLogged wraps runStreamingCommand with the same
// session-log entries Executor.runActual writes for cached/pooled commands,
// so streaming install/uninstall/update/tap/service flows also show up in
// the session log instead of being invisible to it. logCallback may be nil.
func runStreamingCommandLogged(logCallback func(string), cmd *exec.Cmd, onStdout, onStderr func(line string)) (phase streamPhase, stderrText string, err error) {
	cmdStr := "brew"
	if len(cmd.Args) > 1 {
		cmdStr = fmt.Sprintf("brew %s", joinArgs(cmd.Args[1:]))
	}

	if logCallback != nil {
		go logCallback(fmt.Sprintf("Executing: %s", cmdStr))
	}

	phase, stderrText, err = runStreamingCommand(cmd, onStdout, onStderr)

	if logCallback != nil {
		if phase == phaseNone {
			go logCallback(fmt.Sprintf("SUCCESS: %s completed", cmdStr))
		} else {
			outputStr := stderrText
			if len(outputStr) > maxLoggedErrorOutput {
				outputStr = outputStr[:maxLoggedErrorOutput] + "... (truncated)"
			}
			msg := fmt.Sprintf("ERROR: %s failed: %v", cmdStr, err)
			if outputStr != "" {
				msg += fmt.Sprintf("\nOutput: %s", outputStr)
			}
			go logCallback(msg)
		}
	}

	return phase, stderrText, err
}

// detectWailbrewSelfUpdate reports whether a line of `brew upgrade`/`brew
// install` output indicates that WailBrew itself was just updated, so
// callers can trigger the in-app restart prompt.
func detectWailbrewSelfUpdate(line string) bool {
	if !strings.Contains(strings.ToLower(line), "wailbrew") {
		return false
	}
	if strings.Contains(line, "Upgrading") || strings.Contains(line, "Installing") {
		parts := strings.Fields(line)
		for i, part := range parts {
			if (part == "Upgrading" || part == "Installing") && i+1 < len(parts) {
				pkgName := strings.Trim(strings.ToLower(parts[i+1]), ":.,!?")
				if pkgName == "wailbrew" {
					return true
				}
			}
		}
	}
	return strings.Contains(line, "successfully")
}
