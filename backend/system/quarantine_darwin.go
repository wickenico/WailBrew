//go:build darwin
// +build darwin

package system

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// caskInfoV2 is the minimal shape of `brew info --cask --json=v2` output that we
// care about: the top-level "casks" array, and within each cask its "token" and
// "artifacts" list.
type caskInfoV2 struct {
	Casks []struct {
		Token     string        `json:"token"`
		Artifacts []interface{} `json:"artifacts"`
	} `json:"casks"`
}

// ResolveCaskAppPath runs `brew info --cask --json=v2 <caskName>` and inspects
// the artifacts field to find the installed .app path.
//
//   - If an "app" artifact is found, appPath is the full path (e.g.
//     /Applications/Firefox.app) and isPkg is false.
//   - If only "pkg" artifacts are found, appPath is "" and isPkg is true; the
//     caller should skip quarantine removal and emit an informational message.
//   - On any other failure, err is non-nil.
//
// The appDir argument is the directory to prepend when the cask artifact only
// records the bare filename; pass "" to default to /Applications.
func ResolveCaskAppPath(brewPath, caskName, appDir string) (appPath string, isPkg bool, err error) {
	if appDir == "" {
		appDir = "/Applications"
	}

	out, err := exec.Command(brewPath, "info", "--cask", "--json=v2", caskName).Output()
	if err != nil {
		return "", false, fmt.Errorf("brew info failed for %s: %w", caskName, err)
	}

	return parseCaskArtifacts(out, appDir)
}

// parseCaskArtifacts parses the raw JSON from `brew info --cask --json=v2` and
// extracts the first .app path (or detects pkg-only installs).
// Separated from ResolveCaskAppPath to allow unit testing without shelling out.
func parseCaskArtifacts(jsonBytes []byte, appDir string) (appPath string, isPkg bool, err error) {
	// Trim any leading non-JSON warnings Homebrew may emit
	start := bytes.IndexByte(jsonBytes, '{')
	if start == -1 {
		return "", false, fmt.Errorf("no JSON found in brew info output")
	}
	jsonBytes = jsonBytes[start:]

	var info caskInfoV2
	if err := json.Unmarshal(jsonBytes, &info); err != nil {
		return "", false, fmt.Errorf("failed to parse brew info JSON: %w", err)
	}

	if len(info.Casks) == 0 {
		return "", false, fmt.Errorf("no cask data in brew info output")
	}

	cask := info.Casks[0]
	hasPkg := false

	// Artifacts is a heterogeneous array. Each element is either:
	//   - a string (name of an artifact type with no targets)
	//   - an object like {"app": ["Name.app"]} or {"pkg": ["installer.pkg"]}
	for _, raw := range cask.Artifacts {
		obj, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}

		// Check for "app" key
		if appList, ok := obj["app"]; ok {
			if arr, ok := appList.([]interface{}); ok && len(arr) > 0 {
				name, ok := arr[0].(string)
				if ok && name != "" {
					// The artifact may be a bare filename or an absolute path
					if strings.HasPrefix(name, "/") {
						return name, false, nil
					}
					return appDir + "/" + name, false, nil
				}
			}
		}

		// Check for "pkg" key
		if _, ok := obj["pkg"]; ok {
			hasPkg = true
		}
	}

	if hasPkg {
		return "", true, nil
	}

	return "", false, fmt.Errorf("no app or pkg artifact found for cask %s", cask.Token)
}

// AppNameFromPath returns the process name to use with pgrep / AppleScript
// given a full .app bundle path like /Applications/Firefox.app → "Firefox".
func AppNameFromPath(appPath string) string {
	base := appPath
	if idx := strings.LastIndex(base, "/"); idx != -1 {
		base = base[idx+1:]
	}
	base = strings.TrimSuffix(base, ".app")
	return base
}

// IsAppRunning returns true if a process named exactly appName is currently
// running. Uses pgrep -x which matches the full process name exactly.
func IsAppRunning(appName string) bool {
	err := exec.Command("pgrep", "-x", appName).Run()
	return err == nil
}

// QuitAppGracefully asks the named application to quit via AppleScript, then
// polls until the process exits or the 10-second timeout expires. If the
// process is still alive after the timeout, it is killed with pkill -x.
func QuitAppGracefully(appName string) error {
	script := fmt.Sprintf(`tell application "%s" to quit`, appName)
	quitCmd := exec.Command("osascript", "-e", script)
	// Ignore osascript errors — the app may not support AppleScript quit but
	// pgrep will tell us the truth about whether it exited.
	_ = quitCmd.Run()

	// Poll for up to 10 seconds
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if !IsAppRunning(appName) {
			return nil
		}
		time.Sleep(500 * time.Millisecond)
	}

	// Timeout — fall back to pkill
	if err := exec.Command("pkill", "-x", appName).Run(); err != nil {
		return fmt.Errorf("pkill %s failed: %w", appName, err)
	}
	return nil
}

// RemoveQuarantine removes the com.apple.quarantine extended attribute
// recursively from appPath using xattr(1).
func RemoveQuarantine(appPath string) error {
	out, err := exec.Command("xattr", "-r", "-d", "com.apple.quarantine", appPath).CombinedOutput()
	if err != nil {
		// xattr exits non-zero if the attribute wasn't set — treat that as success
		if strings.Contains(string(out), "No such xattr") ||
			strings.Contains(string(out), "attribute not found") {
			return nil
		}
		return fmt.Errorf("xattr failed for %s: %w (output: %s)", appPath, err, string(out))
	}
	return nil
}

// LaunchApp opens the .app bundle at appPath using the open(1) command.
func LaunchApp(appPath string) error {
	if err := exec.Command("open", appPath).Start(); err != nil {
		return fmt.Errorf("open %s failed: %w", appPath, err)
	}
	return nil
}
