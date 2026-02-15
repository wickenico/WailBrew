package brew

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
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
	}
}

// InstallBrewPackage installs a package with live progress updates
func (s *ActionsService) InstallBrewPackage(ctx context.Context, packageName string) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("installStart", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageInstallProgress", startMessage)

	cmd := exec.Command(s.brewPath, "install", packageName)
	cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageInstallProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageInstallProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := s.getBackendMsg("errorStartingInstall", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageInstallProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("packageInstallProgress", fmt.Sprintf("📦 %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("packageInstallProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()
	if err != nil {
		errorMsg := s.getBackendMsg("installFailed", map[string]string{"name": packageName, "error": err.Error()})
		s.eventEmitter.Emit("packageInstallProgress", errorMsg)
		s.eventEmitter.Emit("packageInstallComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := s.getBackendMsg("installSuccess", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageInstallProgress", successMsg)
	s.eventEmitter.Emit("packageInstallComplete", successMsg)
	return successMsg
}

// RemoveBrewPackage uninstalls a package with live progress updates
func (s *ActionsService) RemoveBrewPackage(ctx context.Context, packageName string) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("uninstallStart", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageUninstallProgress", startMessage)

	cmd := exec.Command(s.brewPath, "uninstall", packageName)
	cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUninstallProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUninstallProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := s.getBackendMsg("errorStartingUninstall", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUninstallProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("packageUninstallProgress", fmt.Sprintf("🗑️ %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("packageUninstallProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()
	if err != nil {
		errorMsg := s.getBackendMsg("uninstallFailed", map[string]string{"name": packageName, "error": err.Error()})
		s.eventEmitter.Emit("packageUninstallProgress", errorMsg)
		s.eventEmitter.Emit("packageUninstallComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := s.getBackendMsg("uninstallSuccess", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageUninstallProgress", successMsg)
	s.eventEmitter.Emit("packageUninstallComplete", successMsg)
	return successMsg
}

// RunUpdateCommand executes the brew upgrade command and returns the result
func (s *ActionsService) RunUpdateCommand(packageName string, useForce bool) (finalMessage string, wailbrewUpdated bool, shouldRetry bool) {
	args := []string{"upgrade"}
	if useForce {
		args = append(args, "--force")
	}
	args = append(args, packageName)

	cmd := exec.Command(s.brewPath, args...)
	cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := s.getBackendMsg("errorStartingUpdate", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	}

	// Capture stderr for error detection
	var stderrOutput strings.Builder

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("📦 %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				stderrOutput.WriteString(line)
				stderrOutput.WriteString("\n")
				s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	if err != nil {
		stderrStr := stderrOutput.String()
		// Check if this is the "app already exists" error and we haven't tried --force yet
		if !useForce && s.isAppExistsError(stderrStr) {
			return "", false, true
		}
		finalMessage = s.getBackendMsg("updateFailed", map[string]string{"name": packageName, "error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", finalMessage)
		return finalMessage, false, false
	}

	finalMessage = s.getBackendMsg("updateSuccess", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageUpdateProgress", finalMessage)

	// Check if WailBrew itself was updated
	if strings.ToLower(packageName) == "wailbrew" {
		wailbrewUpdated = true
	}

	return finalMessage, wailbrewUpdated, false
}

// UpdateBrewPackage upgrades a package with live progress updates
func (s *ActionsService) UpdateBrewPackage(ctx context.Context, packageName string) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("updateStart", map[string]string{"name": packageName})
	s.eventEmitter.Emit("packageUpdateProgress", startMessage)

	// Try normal upgrade first
	finalMessage, wailbrewUpdated, shouldRetry := s.RunUpdateCommand(packageName, false)

	// If update failed with "app already exists" error and it's a cask, retry with --force
	if shouldRetry && s.isPackageCask(packageName) {
		s.eventEmitter.Emit("packageUpdateProgress", s.getBackendMsg("updateRetryingWithForce", map[string]string{"name": packageName}))
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
		return fmt.Sprintf("❌ Homebrew validation failed: %v", err)
	}

	if len(packageNames) == 0 {
		return "❌ No packages selected for update"
	}

	// Build brew upgrade command with specific packages
	args := []string{"upgrade"}
	args = append(args, packageNames...)

	cmd := exec.Command(s.brewPath, args...)
	cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Sprintf("❌ Error creating output pipe: %v", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Sprintf("❌ Error creating error pipe: %v", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Sprintf("❌ Error starting update: %v", err)
	}

	// Track which packages were updated (especially wailbrew)
	updatedPackages := make(map[string]bool)
	var stderrOutput strings.Builder

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("📦 %s", line))

				// Detect if wailbrew is being updated
				if strings.Contains(strings.ToLower(line), "wailbrew") {
					if strings.Contains(line, "Upgrading") || strings.Contains(line, "Installing") {
						parts := strings.Fields(line)
						for i, part := range parts {
							if (part == "Upgrading" || part == "Installing") && i+1 < len(parts) {
								pkgName := strings.ToLower(parts[i+1])
								pkgName = strings.Trim(pkgName, ":.,!?")
								if pkgName == "wailbrew" {
									updatedPackages["wailbrew"] = true
								}
							}
						}
					}
					if strings.Contains(line, "successfully") && strings.Contains(strings.ToLower(line), "wailbrew") {
						updatedPackages["wailbrew"] = true
					}
				}
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				stderrOutput.WriteString(line)
				stderrOutput.WriteString("\n")
				s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	var finalMessage string
	if err != nil {
		stderrStr := stderrOutput.String()
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
				s.eventEmitter.Emit("packageUpdateProgress", s.getBackendMsg("updateRetryingFailedCasks", map[string]string{"count": fmt.Sprintf("%d", len(failedCasks))}))
				for _, pkg := range failedCasks {
					s.eventEmitter.Emit("packageUpdateProgress", s.getBackendMsg("updateRetryingWithForce", map[string]string{"name": pkg}))
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
	startMessage := s.getBackendMsg("updateAllStart", map[string]string{})
	s.eventEmitter.Emit("packageUpdateProgress", startMessage)

	// Build upgrade command respecting the user's Outdated Detection Mode setting
	upgradeArgs := []string{"upgrade"}
	outdatedFlag := s.getOutdatedFlag()
	if outdatedFlag == "greedy" {
		upgradeArgs = append(upgradeArgs, "--greedy")
	} else if outdatedFlag == "greedy-auto-updates" {
		upgradeArgs = append(upgradeArgs, "--greedy-auto-updates")
	}
	// If outdatedFlag is "none", no additional flag is added (standard mode)
	cmd := exec.Command(s.brewPath, upgradeArgs...)
	cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := s.getBackendMsg("errorStartingUpdateAll", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", errorMsg)
		return errorMsg
	}

	// Track which packages are being updated
	updatedPackages := make(map[string]bool)

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("📦 %s", line))

				// Detect if wailbrew is being updated
				if strings.Contains(strings.ToLower(line), "wailbrew") {
					if strings.Contains(line, "Upgrading") || strings.Contains(line, "Installing") {
						parts := strings.Fields(line)
						for i, part := range parts {
							if (part == "Upgrading" || part == "Installing") && i+1 < len(parts) {
								pkgName := strings.ToLower(parts[i+1])
								pkgName = strings.Trim(pkgName, ":.,!?")
								if pkgName == "wailbrew" {
									updatedPackages["wailbrew"] = true
								}
							}
						}
					}
					if strings.Contains(line, "successfully") && strings.Contains(strings.ToLower(line), "wailbrew") {
						updatedPackages["wailbrew"] = true
					}
				}
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("packageUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	var finalMessage string
	if err != nil {
		finalMessage = s.getBackendMsg("updateAllFailed", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("packageUpdateProgress", finalMessage)
	} else {
		finalMessage = s.getBackendMsg("updateAllSuccess", map[string]string{})
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
