package brew

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"regexp"
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
	logCallback      func(string)
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
	logCallback func(string),
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
		logCallback:   logCallback,
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

// InstallBrewPackage installs a package with live progress updates. isCask
// should be true when the caller knows the target is a cask, so --cask is
// passed and Homebrew doesn't default to a same-named formula instead.
func (s *ActionsService) InstallBrewPackage(ctx context.Context, packageName string, isCask bool) string {
	return s.runInstall(packageName, BuildInstallArgs(packageName, isCask), installMessages, nil)
}

// installMessageKeys are the translation keys runInstall reports with.
type installMessageKeys struct {
	start, success, failed string
}

var (
	installMessages      = installMessageKeys{"backend.install.start", "backend.install.success", "backend.install.failed"}
	adoptMessages        = installMessageKeys{"backend.adopt.start", "backend.adopt.success", "backend.adopt.failed"}
	adoptReplaceMessages = installMessageKeys{"backend.adopt.replaceStart", "backend.adopt.success", "backend.adopt.failed"}
)

// AdoptBrewCask brings an app installed outside Homebrew under management of
// the given cask. It reuses the install events, so the UI shows the same live
// log. When --adopt refuses because the existing app differs from the cask,
// packageAdoptMismatch is emitted so the UI can offer to replace the app
// (replace=true, which runs --force instead).
func (s *ActionsService) AdoptBrewCask(ctx context.Context, token string, replace bool) string {
	messages := adoptMessages
	if replace {
		messages = adoptReplaceMessages
	}
	return s.runInstall(token, BuildAdoptArgs(token, replace), messages, func(stderr string) {
		// macOS refused to let brew touch the existing bundle. This is checked
		// first: a replace would fail the same way.
		if appPath, denied := AppManagementDeniedPath(stderr); denied {
			if payload, err := json.Marshal(map[string]string{"package": token, "app": appPath}); err == nil {
				s.eventEmitter.Emit("packageAppManagementRequired", string(payload))
			}
			return
		}
		if !replace && IsAdoptMismatchError(stderr) {
			if payload, err := json.Marshal(map[string]string{"package": token}); err == nil {
				s.eventEmitter.Emit("packageAdoptMismatch", string(payload))
			}
		}
	})
}

var appManagementDenied = regexp.MustCompile(`(?m): (/[^:\n]*?\.app)(?:/[^:\n]*)?: Operation not permitted$`)

// AppManagementDeniedPath reports whether brew failed because macOS' App
// Management protection blocked changes to an app bundle (e.g. `chgrp:
// /Applications/Keka.app/Contents/MacOS/Keka: Operation not permitted`), and
// returns that bundle's path.
func AppManagementDeniedPath(stderr string) (string, bool) {
	match := appManagementDenied.FindStringSubmatch(stderr)
	if match == nil {
		return "", false
	}
	return match[1], true
}

// IsAdoptMismatchError reports whether brew refused --adopt because the
// existing app bundle is not the version the cask would install.
func IsAdoptMismatchError(stderr string) bool {
	return strings.Contains(stderr, "is different from the one being installed")
}

// runInstall runs a brew install command with live progress events.
// onRunError is called with stderr when the command itself failed.
func (s *ActionsService) runInstall(packageName string, args []string, messages installMessageKeys, onRunError func(stderr string)) string {
	// Emit initial progress
	startMessage := s.getBackendMsg(messages.start, map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageInstallProgress", startMessage)

	cmd := exec.Command(s.brewPath, args...)
	system.ApplyEnvironment(cmd, s.getBrewEnvFunc())

	phase, stderrStr, err := runStreamingCommandLogged(s.logCallback, cmd,
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
		if onRunError != nil {
			onRunError(stderrStr)
		}
		errorMsg := s.getBackendMsg(messages.failed, map[string]string{"name": packageName, "error": err.Error()})
		s.eventEmitter.Emit("packageInstallProgress", errorMsg)
		s.eventEmitter.Emit("packageInstallComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := s.getBackendMsg(messages.success, map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageInstallProgress", successMsg)

	// Post-install: remove quarantine attribute for casks
	if s.isPackageCask(packageName) {
		s.postInstallCask(packageName, "packageInstallProgress")
	}

	s.eventEmitter.Emit("packageInstallComplete", successMsg)
	return successMsg
}

// RemoveBrewPackage uninstalls a package with live progress updates. isCask
// comes from the caller, which knows the package type from the list it was
// picked from; casks get --cask so the token cannot resolve to a formula.
// When zap is true and the package is a cask, --zap is passed so Homebrew also
// removes leftover preferences, caches and support files.
func (s *ActionsService) RemoveBrewPackage(ctx context.Context, packageName string, zap, isCask bool) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("backend.uninstall.start", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageUninstallProgress", startMessage)

	args := BuildUninstallArgs(packageName, zap, isCask)

	cmd := exec.Command(s.brewPath, args...)
	system.ApplyEnvironment(cmd, s.getBrewEnvFunc())

	phase, _, err := runStreamingCommandLogged(s.logCallback, cmd,
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

// RunUpdateCommand executes the brew upgrade command and returns the result.
// isCask must come from the caller: probing brew by name is unreliable for
// tokens that also match a formula or a renamed formula.
func (s *ActionsService) RunUpdateCommand(packageName string, isCask, useForce bool) (finalMessage string, wailbrewUpdated bool, shouldRetry bool) {
	args := BuildUpgradeArgs(packageName, isCask, s.getOutdatedFlag(), useForce)

	cmd := exec.Command(s.brewPath, args...)
	system.ApplyEnvironment(cmd, s.getBrewEnvFunc())

	phase, stderrStr, err := runStreamingCommandLogged(s.logCallback, cmd,
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
	if isCask {
		s.postInstallCask(packageName, "packageUpdateProgress")
	}

	// Check if WailBrew itself was updated
	if strings.EqualFold(caskToken(packageName), "wailbrew") {
		wailbrewUpdated = true
	}

	return finalMessage, wailbrewUpdated, false
}

// UpdateBrewPackage upgrades a package with live progress updates
func (s *ActionsService) UpdateBrewPackage(ctx context.Context, packageName string, isCask bool) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("backend.update.start", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageUpdateProgress", startMessage)

	// Try normal upgrade first
	finalMessage, wailbrewUpdated, shouldRetry := s.RunUpdateCommand(packageName, isCask, false)

	// If update failed with "app already exists" error and it's a cask, retry with --force
	if shouldRetry && isCask {
		s.eventEmitter.Emit("packageUpdateProgress", s.getBackendMsg("backend.update.retryingWithForce", map[string]string{"name": packageName}))
		finalMessage, wailbrewUpdated, _ = s.RunUpdateCommand(packageName, true, true)
	}

	// Signal completion
	s.eventEmitter.Emit("packageUpdateComplete", finalMessage)

	// If WailBrew was updated, emit event to show restart dialog
	if wailbrewUpdated {
		s.eventEmitter.Emit("wailbrewUpdated", "")
	}

	return finalMessage
}

// UpdateSelectedBrewPackages upgrades specific packages with live progress
// updates. Formulae and casks are upgraded in separate brew runs so casks can
// be passed with --cask; without it Homebrew resolves a token shared with a
// formula (or a renamed formula) to the formula.
func (s *ActionsService) UpdateSelectedBrewPackages(ctx context.Context, formulae, casks []string) string {
	// Validate brew installation first
	if err := s.validateFunc(); err != nil {
		msg := fmt.Sprintf("❌ Homebrew validation failed: %v", err)
		s.eventEmitter.Emit("packageUpdateProgress", msg)
		s.eventEmitter.Emit("packageUpdateComplete", msg)
		return msg
	}

	total := len(formulae) + len(casks)
	if total == 0 {
		msg := "❌ No packages selected for update"
		s.eventEmitter.Emit("packageUpdateProgress", msg)
		s.eventEmitter.Emit("packageUpdateComplete", msg)
		return msg
	}

	batches := []struct {
		names  []string
		isCask bool
	}{
		{formulae, false},
		{casks, true},
	}

	wailbrewUpdated := false
	var failures []string
	for _, batch := range batches {
		if len(batch.names) == 0 {
			continue
		}
		errMsg, aborted, updated := s.upgradeSelectedBatch(batch.names, batch.isCask)
		wailbrewUpdated = wailbrewUpdated || updated
		if aborted {
			s.eventEmitter.Emit("packageUpdateProgress", errMsg)
			s.eventEmitter.Emit("packageUpdateComplete", errMsg)
			return errMsg
		}
		if errMsg != "" {
			failures = append(failures, errMsg)
		}
	}

	var finalMessage string
	if len(failures) > 0 {
		finalMessage = strings.Join(failures, "\n")
	} else {
		finalMessage = fmt.Sprintf("✅ Successfully updated %d selected package(s)", total)
	}
	s.eventEmitter.Emit("packageUpdateProgress", finalMessage)

	// Signal completion
	s.eventEmitter.Emit("packageUpdateComplete", finalMessage)

	// If WailBrew was updated, emit event to show restart dialog
	if wailbrewUpdated {
		s.eventEmitter.Emit("wailbrewUpdated", "")
	}

	return finalMessage
}

// upgradeSelectedBatch runs a single brew upgrade for packages of one type.
// errMsg is empty on success. aborted reports that brew could not be started
// at all, so no further batch should run. Casks that fail because the app
// already exists are retried individually with --force.
func (s *ActionsService) upgradeSelectedBatch(names []string, isCask bool) (errMsg string, aborted bool, wailbrewUpdated bool) {
	cmd := exec.Command(s.brewPath, BuildUpgradeSelectedArgs(names, isCask)...)
	system.ApplyEnvironment(cmd, s.getBrewEnvFunc())

	phase, stderrStr, err := runStreamingCommandLogged(s.logCallback, cmd,
		func(line string) {
			s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("📦 %s", line))
			if detectWailbrewSelfUpdate(line) {
				wailbrewUpdated = true
			}
		},
		func(line string) { s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("⚠️ %s", line)) },
	)

	switch phase {
	case phaseStdoutPipe:
		return fmt.Sprintf("❌ Error creating output pipe: %v", err), true, wailbrewUpdated
	case phaseStderrPipe:
		return fmt.Sprintf("❌ Error creating error pipe: %v", err), true, wailbrewUpdated
	case phaseStart:
		return fmt.Sprintf("❌ Error starting update: %v", err), true, wailbrewUpdated
	case phaseRun:
		if isCask && s.isAppExistsError(stderrStr) {
			if failedCasks := s.extractFailed(stderrStr); len(failedCasks) > 0 {
				s.eventEmitter.Emit("packageUpdateProgress", s.getBackendMsg("backend.update.retryingFailedCasks", map[string]string{"count": fmt.Sprintf("%d", len(failedCasks))}))
				for _, pkg := range failedCasks {
					s.eventEmitter.Emit("packageUpdateProgress", s.getBackendMsg("backend.update.retryingWithForce", map[string]string{"name": pkg}))
					if _, updated, _ := s.RunUpdateCommand(pkg, true, true); updated {
						wailbrewUpdated = true
					}
				}
				s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("✅ Retried %d failed cask(s) with --force", len(failedCasks)))
				return "", false, wailbrewUpdated
			}
		}
		return fmt.Sprintf("❌ Update failed for selected packages: %v", err), false, wailbrewUpdated
	}

	// Post-upgrade: run quarantine removal for each upgraded cask. The bulk
	// brew command does not go through RunUpdateCommand, so postInstallCask
	// is not triggered transitively and must run here.
	if isCask {
		for _, pkg := range names {
			s.postInstallCask(pkg, "packageUpdateProgress")
		}
	}

	return "", false, wailbrewUpdated
}

// UpdateAllBrewPackages upgrades all outdated packages with live progress updates
func (s *ActionsService) UpdateAllBrewPackages(ctx context.Context, packageType string) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("backend.updateAll.start", map[string]string{})
	s.eventEmitter.Emit("packageUpdateProgress", startMessage)

	// Build upgrade command respecting the user's Outdated Detection Mode setting
	upgradeArgs := BuildUpgradeAllArgs(s.getOutdatedFlag(), packageType)
	cmd := exec.Command(s.brewPath, upgradeArgs...)
	system.ApplyEnvironment(cmd, s.getBrewEnvFunc())

	// Track which packages are being updated
	updatedPackages := make(map[string]bool)

	phase, _, err := runStreamingCommandLogged(s.logCallback, cmd,
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
