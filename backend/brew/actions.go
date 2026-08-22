package brew

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"

	"WailBrew/backend/system"
)

// EventEmitter handles event emission for real-time updates
type EventEmitter interface {
	Emit(event string, data string)
}

// ActionsService provides install/uninstall/update functionality
type ActionsService struct {
	brewPath         string
	getBrewEnvFunc   func() []string
	getBackendMsg    func(string, map[string]string) string
	eventEmitter     EventEmitter
	isPackageCask    func(string) bool
	isAppExistsError func(string) bool
	extractFailed    func(string) []string
	validateFunc     func() error
	getOutdatedFlag  func() string
	getNoQuarantine  func() bool
	getAutoRelaunch  func() bool
	getCaskAppDir    func() string
}

// NewActionsService creates a new actions service
func NewActionsService(
	brewPath string,
	getBrewEnvFunc func() []string,
	getBackendMsg func(string, map[string]string) string,
	eventEmitter EventEmitter,
	isPackageCask func(string) bool,
	isAppExistsError func(string) bool,
	extractFailed func(string) []string,
	validateFunc func() error,
	getOutdatedFlag func() string,
	getNoQuarantine func() bool,
	getAutoRelaunch func() bool,
) *ActionsService {
	return &ActionsService{
		brewPath:         brewPath,
		getBrewEnvFunc:   getBrewEnvFunc,
		getBackendMsg:    getBackendMsg,
		eventEmitter:     eventEmitter,
		isPackageCask:    isPackageCask,
		isAppExistsError: isAppExistsError,
		extractFailed:    extractFailed,
		validateFunc:     validateFunc,
		getOutdatedFlag:  getOutdatedFlag,
		getNoQuarantine:  getNoQuarantine,
		getAutoRelaunch:  getAutoRelaunch,
		// getCaskAppDir is populated separately — the App-level setting is not
		// available at construction time in the current wiring, so we use a
		// safe no-op default that resolves to /Applications.
		getCaskAppDir: func() string { return "" },
	}
}

// postInstallCask runs quarantine removal (and optional quit/relaunch) for a
// successfully installed or upgraded cask. Errors are emitted as warnings but
// never fail the overall operation — the cask itself was already installed.
func (s *ActionsService) postInstallCask(packageName, progressEvent string) {
	if s.getNoQuarantine == nil || !s.getNoQuarantine() {
		return
	}

	appDir := ""
	if s.getCaskAppDir != nil {
		appDir = s.getCaskAppDir()
	}

	// Resolve the installed .app path from brew info
	appPath, isPkg, err := system.ResolveCaskAppPath(s.brewPath, packageName, appDir)
	if err != nil {
		warnMsg := s.getBackendMsg("backend.quarantine.resolveFailed", map[string]string{
			"name":  packageName,
			"error": err.Error(),
		})
		s.eventEmitter.Emit(progressEvent, warnMsg)
		return
	}

	// .pkg-based cask — skip with informational message
	if isPkg {
		infoMsg := s.getBackendMsg("backend.quarantine.skippedPkg", map[string]string{
			"name": packageName,
		})
		s.eventEmitter.Emit(progressEvent, infoMsg)
		return
	}

	appName := system.AppNameFromPath(appPath)
	wasRunning := false

	// Quit the app gracefully if it is running and auto-relaunch is enabled
	if s.getAutoRelaunch != nil && s.getAutoRelaunch() && system.IsAppRunning(appName) {
		quitMsg := s.getBackendMsg("backend.quarantine.quitting", map[string]string{"name": appName})
		s.eventEmitter.Emit(progressEvent, quitMsg)

		if err := system.QuitAppGracefully(appName); err != nil {
			warnMsg := s.getBackendMsg("backend.quarantine.quitFailed", map[string]string{
				"name":  appName,
				"error": err.Error(),
			})
			s.eventEmitter.Emit(progressEvent, warnMsg)
			// Proceed with quarantine removal even if quit failed
		} else {
			wasRunning = true
		}
	}

	// Remove the quarantine attribute
	removeMsg := s.getBackendMsg("backend.quarantine.removing", map[string]string{"path": appPath})
	s.eventEmitter.Emit(progressEvent, removeMsg)

	if err := system.RemoveQuarantine(appPath); err != nil {
		warnMsg := s.getBackendMsg("backend.quarantine.removeFailed", map[string]string{
			"path":  appPath,
			"error": err.Error(),
		})
		s.eventEmitter.Emit(progressEvent, warnMsg)
		// Still try to relaunch even if xattr had issues (attribute may not have
		// been set at all, which xattr treats as a non-fatal error).
	} else {
		removedMsg := s.getBackendMsg("backend.quarantine.removed", map[string]string{"path": appPath})
		s.eventEmitter.Emit(progressEvent, removedMsg)
	}

	// Relaunch the app if it was running before the upgrade
	if wasRunning {
		relaunchMsg := s.getBackendMsg("backend.quarantine.relaunching", map[string]string{"name": appName})
		s.eventEmitter.Emit(progressEvent, relaunchMsg)

		if err := system.LaunchApp(appPath); err != nil {
			warnMsg := s.getBackendMsg("backend.quarantine.relaunchFailed", map[string]string{
				"name":  appName,
				"error": err.Error(),
			})
			s.eventEmitter.Emit(progressEvent, warnMsg)
		}
	}
}

// InstallBrewPackage installs a package with live progress updates
func (s *ActionsService) InstallBrewPackage(ctx context.Context, packageName string) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("backend.install.start", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageInstallProgress", startMessage)

	cmd := exec.Command(s.brewPath, BuildInstallArgs(packageName)...)
	system.ApplyEnvironment(cmd, s.getBrewEnvFunc())

	phase, stderrStr, err := runStreamingCommand(cmd,
		func(line string) { s.eventEmitter.Emit("packageInstallProgress", fmt.Sprintf("📦 %s", line)) },
		func(line string) { s.eventEmitter.Emit("packageInstallProgress", fmt.Sprintf("⚠️ %s", line)) },
	)

	switch phase {
	case phaseStdoutPipe:
		errorMsg := s.getBackendMsg("backend.errors.creatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageInstallProgress", errorMsg)
		s.eventEmitter.Emit("packageInstallComplete", errorMsg)
		return errorMsg
	case phaseStderrPipe:
		errorMsg := s.getBackendMsg("backend.errors.creatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageInstallProgress", errorMsg)
		s.eventEmitter.Emit("packageInstallComplete", errorMsg)
		return errorMsg
	case phaseStart:
		errorMsg := s.getBackendMsg("backend.errors.startingInstall", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageInstallProgress", errorMsg)
		s.eventEmitter.Emit("packageInstallComplete", errorMsg)
		return errorMsg
	case phaseRun:
		// Homebrew 6: install can be blocked because the package's tap is not
		// trusted. Surface a distinct event so the UI can offer to trust + retry.
		if IsUntrustedTapError(stderrStr) {
			tapName := ExtractUntrustedTap(stderrStr)
			if payload, jerr := json.Marshal(map[string]string{"package": packageName, "tap": tapName}); jerr == nil {
				s.eventEmitter.Emit("packageInstallTrustRequired", string(payload))
			}
		}
		errorMsg := s.getBackendMsg("backend.install.failed", map[string]string{"name": packageName, "error": err.Error()})
		s.eventEmitter.Emit("packageInstallProgress", errorMsg)
		s.eventEmitter.Emit("packageInstallComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := s.getBackendMsg("backend.install.success", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageInstallProgress", successMsg)

	// Post-install: remove quarantine attribute for casks
	if s.isPackageCask(packageName) {
		s.postInstallCask(packageName, "packageInstallProgress")
	}

	s.eventEmitter.Emit("packageInstallComplete", successMsg)
	return successMsg
}

// RemoveBrewPackage uninstalls a package with live progress updates.
// When zap is true and the package is a cask, --zap is passed so Homebrew also
// removes leftover preferences, caches and support files.
func (s *ActionsService) RemoveBrewPackage(ctx context.Context, packageName string, zap bool) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("backend.uninstall.start", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageUninstallProgress", startMessage)

	// isPackageCask shells out to brew, so only probe when zap was requested.
	isCask := zap && s.isPackageCask(packageName)
	args := BuildUninstallArgs(packageName, zap, isCask)

	cmd := exec.Command(s.brewPath, args...)
	system.ApplyEnvironment(cmd, s.getBrewEnvFunc())

	phase, _, err := runStreamingCommand(cmd,
		func(line string) { s.eventEmitter.Emit("packageUninstallProgress", fmt.Sprintf("🗑️ %s", line)) },
		func(line string) { s.eventEmitter.Emit("packageUninstallProgress", fmt.Sprintf("⚠️ %s", line)) },
	)

	switch phase {
	case phaseStdoutPipe:
		errorMsg := s.getBackendMsg("backend.errors.creatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUninstallProgress", errorMsg)
		s.eventEmitter.Emit("packageUninstallComplete", errorMsg)
		return errorMsg
	case phaseStderrPipe:
		errorMsg := s.getBackendMsg("backend.errors.creatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUninstallProgress", errorMsg)
		s.eventEmitter.Emit("packageUninstallComplete", errorMsg)
		return errorMsg
	case phaseStart:
		errorMsg := s.getBackendMsg("backend.errors.startingUninstall", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUninstallProgress", errorMsg)
		s.eventEmitter.Emit("packageUninstallComplete", errorMsg)
		return errorMsg
	case phaseRun:
		errorMsg := s.getBackendMsg("backend.uninstall.failed", map[string]string{"name": packageName, "error": err.Error()})
		s.eventEmitter.Emit("packageUninstallProgress", errorMsg)
		s.eventEmitter.Emit("packageUninstallComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := s.getBackendMsg("backend.uninstall.success", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageUninstallProgress", successMsg)
	s.eventEmitter.Emit("packageUninstallComplete", successMsg)
	return successMsg
}

// RunUpdateCommand executes the brew upgrade command and returns the result
func (s *ActionsService) RunUpdateCommand(packageName string, useForce bool) (finalMessage string, wailbrewUpdated bool, shouldRetry bool) {
	args := BuildUpgradeArgs(packageName, s.isPackageCask(packageName), s.getOutdatedFlag(), useForce)

	cmd := exec.Command(s.brewPath, args...)
	system.ApplyEnvironment(cmd, s.getBrewEnvFunc())

	phase, stderrStr, err := runStreamingCommand(cmd,
		func(line string) { s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("📦 %s", line)) },
		func(line string) { s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("⚠️ %s", line)) },
	)

	switch phase {
	case phaseStdoutPipe:
		errorMsg := s.getBackendMsg("backend.errors.creatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	case phaseStderrPipe:
		errorMsg := s.getBackendMsg("backend.errors.creatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	case phaseStart:
		errorMsg := s.getBackendMsg("backend.errors.startingUpdate", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	case phaseRun:
		// Check if this is the "app already exists" error and we haven't tried --force yet
		if !useForce && s.isAppExistsError(stderrStr) {
			return "", false, true
		}
		finalMessage = s.getBackendMsg("backend.update.failed", map[string]string{"name": packageName, "error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", finalMessage)
		return finalMessage, false, false
	}

	finalMessage = s.getBackendMsg("backend.update.success", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageUpdateProgress", finalMessage)

	// Post-upgrade: remove quarantine attribute for casks
	if s.isPackageCask(packageName) {
		s.postInstallCask(packageName, "packageUpdateProgress")
	}

	// Check if WailBrew itself was updated
	if strings.ToLower(packageName) == "wailbrew" {
		wailbrewUpdated = true
	}

	return finalMessage, wailbrewUpdated, false
}

// UpdateBrewPackage upgrades a package with live progress updates
func (s *ActionsService) UpdateBrewPackage(ctx context.Context, packageName string) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("backend.update.start", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageUpdateProgress", startMessage)

	// Try normal upgrade first
	finalMessage, wailbrewUpdated, shouldRetry := s.RunUpdateCommand(packageName, false)

	// If update failed with "app already exists" error and it's a cask, retry with --force
	if shouldRetry && s.isPackageCask(packageName) {
		s.eventEmitter.Emit("packageUpdateProgress", s.getBackendMsg("backend.update.retryingWithForce", map[string]string{"name": packageName}))
		finalMessage, wailbrewUpdated, _ = s.RunUpdateCommand(packageName, true)
	}

	// Signal completion
	s.eventEmitter.Emit("packageUpdateComplete", finalMessage)

	// If WailBrew was updated, emit event to show restart dialog
	if wailbrewUpdated {
		s.eventEmitter.Emit("wailbrewUpdated", "")
	}

	return finalMessage
}

// UpdateSelectedBrewPackages upgrades specific packages with live progress updates
func (s *ActionsService) UpdateSelectedBrewPackages(ctx context.Context, packageNames []string) string {
	// Validate brew installation first
	if err := s.validateFunc(); err != nil {
		msg := fmt.Sprintf("❌ Homebrew validation failed: %v", err)
		s.eventEmitter.Emit("packageUpdateProgress", msg)
		s.eventEmitter.Emit("packageUpdateComplete", msg)
		return msg
	}

	if len(packageNames) == 0 {
		msg := "❌ No packages selected for update"
		s.eventEmitter.Emit("packageUpdateProgress", msg)
		s.eventEmitter.Emit("packageUpdateComplete", msg)
		return msg
	}

	// Build brew upgrade command with specific packages
	args := BuildUpgradeSelectedArgs(packageNames)

	cmd := exec.Command(s.brewPath, args...)
	system.ApplyEnvironment(cmd, s.getBrewEnvFunc())

	// Track which packages were updated (especially wailbrew)
	updatedPackages := make(map[string]bool)

	phase, stderrStr, err := runStreamingCommand(cmd,
		func(line string) {
			s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("📦 %s", line))
			if detectWailbrewSelfUpdate(line) {
				updatedPackages["wailbrew"] = true
			}
		},
		func(line string) { s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("⚠️ %s", line)) },
	)

	switch phase {
	case phaseStdoutPipe:
		msg := fmt.Sprintf("❌ Error creating output pipe: %v", err)
		s.eventEmitter.Emit("packageUpdateProgress", msg)
		s.eventEmitter.Emit("packageUpdateComplete", msg)
		return msg
	case phaseStderrPipe:
		msg := fmt.Sprintf("❌ Error creating error pipe: %v", err)
		s.eventEmitter.Emit("packageUpdateProgress", msg)
		s.eventEmitter.Emit("packageUpdateComplete", msg)
		return msg
	case phaseStart:
		msg := fmt.Sprintf("❌ Error starting update: %v", err)
		s.eventEmitter.Emit("packageUpdateProgress", msg)
		s.eventEmitter.Emit("packageUpdateComplete", msg)
		return msg
	}

	var finalMessage string
	if phase == phaseRun {
		// Check if this is the "app already exists" error
		if s.isAppExistsError(stderrStr) {
			// Extract failed package names
			failedPackages := s.extractFailed(stderrStr)
			// Filter to only casks
			var failedCasks []string
			for _, pkg := range failedPackages {
				if s.isPackageCask(pkg) {
					failedCasks = append(failedCasks, pkg)
				}
			}

			// Retry failed casks with --force
			if len(failedCasks) > 0 {
				s.eventEmitter.Emit("packageUpdateProgress", s.getBackendMsg("backend.update.retryingFailedCasks", map[string]string{"count": fmt.Sprintf("%d", len(failedCasks))}))
				for _, pkg := range failedCasks {
					s.eventEmitter.Emit("packageUpdateProgress", s.getBackendMsg("backend.update.retryingWithForce", map[string]string{"name": pkg}))
					_, _, _ = s.RunUpdateCommand(pkg, true)
				}
				finalMessage = fmt.Sprintf("✅ Retried %d failed cask(s) with --force", len(failedCasks))
			} else {
				finalMessage = fmt.Sprintf("❌ Update failed for selected packages: %v", err)
			}
		} else {
			finalMessage = fmt.Sprintf("❌ Update failed for selected packages: %v", err)
		}
		s.eventEmitter.Emit("packageUpdateProgress", finalMessage)
	} else {
		finalMessage = fmt.Sprintf("✅ Successfully updated %d selected package(s)", len(packageNames))
		s.eventEmitter.Emit("packageUpdateProgress", finalMessage)

		// Post-upgrade: run quarantine removal for each upgraded cask.
		// UpdateSelectedBrewPackages uses a single bulk brew command, so
		// postInstallCask is NOT triggered transitively via RunUpdateCommand.
		// We must loop here explicitly.
		for _, pkg := range packageNames {
			if s.isPackageCask(pkg) {
				s.postInstallCask(pkg, "packageUpdateProgress")
			}
		}
	}

	// Signal completion
	s.eventEmitter.Emit("packageUpdateComplete", finalMessage)

	// If WailBrew was updated, emit event to show restart dialog
	if updatedPackages["wailbrew"] {
		s.eventEmitter.Emit("wailbrewUpdated", "")
	}

	return finalMessage
}

// UpdateAllBrewPackages upgrades all outdated packages with live progress updates
func (s *ActionsService) UpdateAllBrewPackages(ctx context.Context) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("backend.updateAll.start", map[string]string{})
	s.eventEmitter.Emit("packageUpdateProgress", startMessage)

	// Build upgrade command respecting the user's Outdated Detection Mode setting
	upgradeArgs := BuildUpgradeAllArgs(s.getOutdatedFlag())
	cmd := exec.Command(s.brewPath, upgradeArgs...)
	system.ApplyEnvironment(cmd, s.getBrewEnvFunc())

	// Track which packages are being updated
	updatedPackages := make(map[string]bool)

	phase, _, err := runStreamingCommand(cmd,
		func(line string) {
			s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("📦 %s", line))
			if detectWailbrewSelfUpdate(line) {
				updatedPackages["wailbrew"] = true
			}
		},
		func(line string) { s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("⚠️ %s", line)) },
	)

	switch phase {
	case phaseStdoutPipe:
		errorMsg := s.getBackendMsg("backend.errors.creatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		s.eventEmitter.Emit("packageUpdateComplete", errorMsg)
		return errorMsg
	case phaseStderrPipe:
		errorMsg := s.getBackendMsg("backend.errors.creatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		s.eventEmitter.Emit("packageUpdateComplete", errorMsg)
		return errorMsg
	case phaseStart:
		errorMsg := s.getBackendMsg("backend.errors.startingUpdateAll", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		s.eventEmitter.Emit("packageUpdateComplete", errorMsg)
		return errorMsg
	}

	var finalMessage string
	if phase == phaseRun {
		finalMessage = s.getBackendMsg("backend.updateAll.failed", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", finalMessage)
	} else {
		finalMessage = s.getBackendMsg("backend.updateAll.success", map[string]string{})
		s.eventEmitter.Emit("packageUpdateProgress", finalMessage)
	}

	// Signal completion
	s.eventEmitter.Emit("packageUpdateComplete", finalMessage)

	// If WailBrew was updated, emit event to show restart dialog
	if updatedPackages["wailbrew"] {
		s.eventEmitter.Emit("wailbrewUpdated", "")
	}

	return finalMessage
}
