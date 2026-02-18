package brew

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// Service provides a high-level interface for brew operations
type Service interface {
	// Startup - optimized data loading for app initialization
	GetStartupData() *StartupData
	GetStartupDataWithUpdate() *StartupData

	// Package listing
	GetAllBrewPackages() [][]string
	GetAllBrewCasks() [][]string
	GetBrewPackages() [][]string
	GetBrewCasks() [][]string
	GetBrewLeaves() []string
	GetBrewTaps() [][]string
	GetBrewTapInfo(repositoryName string) string

	// Package sizes
	GetBrewPackageSizes(packageNames []string) map[string]string
	GetBrewCaskSizes(caskNames []string) map[string]string

	// Database operations
	UpdateBrewDatabase() error
	UpdateBrewDatabaseWithOutput() (string, error)
	ParseNewPackagesFromUpdateOutput(output string) *NewPackagesInfo
	CheckForNewPackages() (*NewPackagesInfo, error)

	// Outdated packages
	GetBrewUpdatablePackages() [][]string
	IsPackageCask(packageName string) bool
	IsAppAlreadyExistsError(stderrOutput string) bool
	ExtractFailedPackagesFromError(stderrOutput string) []string

	// Actions
	InstallBrewPackage(ctx context.Context, packageName string) string
	RemoveBrewPackage(ctx context.Context, packageName string) string
	UpdateBrewPackage(ctx context.Context, packageName string) string
	UpdateSelectedBrewPackages(ctx context.Context, packageNames []string) string
	UpdateAllBrewPackages(ctx context.Context) string

	// Tap operations
	TapBrewRepository(ctx context.Context, repositoryName string) string
	UntapBrewRepository(ctx context.Context, repositoryName string) string

	// Package info
	GetBrewPackageInfoAsJson(packageName string) map[string]interface{}
	GetBrewPackageInfo(packageName string) string
	GetInstalledDependencies(packageName string) []string

	// Other operations
	RunBrewDoctor() string
	GetDeprecatedFormulae(doctorOutput string) []string
	GetBrewCleanupDryRun() (string, error)
	RunBrewCleanupDryRun() string
	RunBrewCleanup() string
	GetHomebrewVersion() (string, error)
	CheckHomebrewUpdate() (map[string]interface{}, error)
	UpdateHomebrew(ctx context.Context) string
	GetHomebrewCaskVersion() (string, error)
	ExportBrewfile(filePath string) error

	// Cache management
	ClearCache()
}

// NewPackagesInfo contains information about newly discovered packages
type NewPackagesInfo struct {
	NewFormulae []string `json:"newFormulae"`
	NewCasks    []string `json:"newCasks"`
}

// serviceImpl implements the Service interface
type serviceImpl struct {
	executor        *Executor
	getBrewEnvFunc  func() []string
	logFunc         func(string)
	validateFunc    func() error
	brewPath        string
	getBackendMsg   func(string, map[string]string) string
	eventEmitter    EventEmitter
	getOutdatedFlag func() string
	extractJSON     func(string) (string, string, error)
	parseWarnings   func(string) map[string]string

	// Module services
	listService     *ListService
	sizeService     *SizeService
	databaseService *DatabaseService
	outdatedService *OutdatedService
	actionsService  *ActionsService
	tapService      *TapService
	startupService  *StartupService
}

// NewService creates a new brew service
func NewService(
	executor *Executor,
	brewPath string,
	getBrewEnvFunc func() []string,
	logFunc func(string),
	validateFunc func() error,
	getBackendMsg func(string, map[string]string) string,
	eventEmitter EventEmitter,
	getOutdatedFlag func() string,
	getCustomOutdatedArgs func() string,
	extractJSON func(string) (string, string, error),
	parseWarnings func(string) map[string]string,
) Service {
	// Create database service first (needs executor)
	databaseService := NewDatabaseService(executor)

	// Create list service
	listService := NewListService(
		executor,
		validateFunc,
		func() map[string]bool { return databaseService.knownPackages },
		func() { databaseService.knownPackagesMux.Lock() },
		func() { databaseService.knownPackagesMux.Unlock() },
	)

	// Create size service
	sizeService := NewSizeService(executor, logFunc, extractJSON)

	// Create outdated service
	outdatedService := NewOutdatedService(
		executor,
		validateFunc,
		logFunc,
		extractJSON,
		parseWarnings,
		func(names []string, isCask bool) map[string]string {
			return sizeService.GetPackageSizes(names, isCask)
		},
		getOutdatedFlag,
		getCustomOutdatedArgs,
	)

	// Create actions service
	actionsService := NewActionsService(
		brewPath,
		getBrewEnvFunc,
		getBackendMsg,
		eventEmitter,
		outdatedService.IsPackageCask,
		outdatedService.IsAppAlreadyExistsError,
		outdatedService.ExtractFailedPackagesFromError,
		validateFunc,
		getOutdatedFlag,
	)

	// Create tap service
	tapService := NewTapService(brewPath, getBrewEnvFunc, getBackendMsg, eventEmitter)

	// Create startup service for optimized initial data loading
	startupService := NewStartupService(listService, outdatedService, databaseService)

	return &serviceImpl{
		executor:        executor,
		getBrewEnvFunc:  getBrewEnvFunc,
		logFunc:         logFunc,
		validateFunc:    validateFunc,
		brewPath:        brewPath,
		getBackendMsg:   getBackendMsg,
		eventEmitter:    eventEmitter,
		getOutdatedFlag: getOutdatedFlag,
		extractJSON:     extractJSON,
		parseWarnings:   parseWarnings,
		listService:     listService,
		sizeService:     sizeService,
		databaseService: databaseService,
		outdatedService: outdatedService,
		actionsService:  actionsService,
		tapService:      tapService,
		startupService:  startupService,
	}
}

// Startup methods
func (s *serviceImpl) GetStartupData() *StartupData {
	return s.startupService.GetStartupData()
}

func (s *serviceImpl) GetStartupDataWithUpdate() *StartupData {
	return s.startupService.GetStartupDataWithUpdate()
}

// Cache management
func (s *serviceImpl) ClearCache() {
	s.executor.ClearCache()
}

// Package listing methods
func (s *serviceImpl) GetAllBrewPackages() [][]string {
	return s.listService.GetAllBrewPackages()
}

func (s *serviceImpl) GetAllBrewCasks() [][]string {
	return s.listService.GetAllBrewCasks()
}

func (s *serviceImpl) GetBrewPackages() [][]string {
	return s.listService.GetBrewPackages()
}

func (s *serviceImpl) GetBrewCasks() [][]string {
	return s.listService.GetBrewCasks()
}

func (s *serviceImpl) GetBrewLeaves() []string {
	return s.listService.GetBrewLeaves()
}

func (s *serviceImpl) GetBrewTaps() [][]string {
	return s.listService.GetBrewTaps()
}

func (s *serviceImpl) GetBrewTapInfo(repositoryName string) string {
	return s.listService.GetBrewTapInfo(repositoryName)
}

// Package size methods
func (s *serviceImpl) GetBrewPackageSizes(packageNames []string) map[string]string {
	return s.sizeService.GetPackageSizes(packageNames, false)
}

func (s *serviceImpl) GetBrewCaskSizes(caskNames []string) map[string]string {
	return s.sizeService.GetPackageSizes(caskNames, true)
}

// Database methods
func (s *serviceImpl) UpdateBrewDatabase() error {
	return s.databaseService.UpdateBrewDatabase()
}

func (s *serviceImpl) UpdateBrewDatabaseWithOutput() (string, error) {
	return s.databaseService.UpdateBrewDatabaseWithOutput()
}

func (s *serviceImpl) ParseNewPackagesFromUpdateOutput(output string) *NewPackagesInfo {
	return s.databaseService.ParseNewPackagesFromUpdateOutput(output)
}

func (s *serviceImpl) CheckForNewPackages() (*NewPackagesInfo, error) {
	return s.databaseService.CheckForNewPackages()
}

// Outdated package methods
func (s *serviceImpl) GetBrewUpdatablePackages() [][]string {
	return s.outdatedService.GetBrewUpdatablePackages()
}

func (s *serviceImpl) IsPackageCask(packageName string) bool {
	return s.outdatedService.IsPackageCask(packageName)
}

func (s *serviceImpl) IsAppAlreadyExistsError(stderrOutput string) bool {
	return s.outdatedService.IsAppAlreadyExistsError(stderrOutput)
}

func (s *serviceImpl) ExtractFailedPackagesFromError(stderrOutput string) []string {
	return s.outdatedService.ExtractFailedPackagesFromError(stderrOutput)
}

// Action methods
func (s *serviceImpl) InstallBrewPackage(ctx context.Context, packageName string) string {
	return s.actionsService.InstallBrewPackage(ctx, packageName)
}

func (s *serviceImpl) RemoveBrewPackage(ctx context.Context, packageName string) string {
	return s.actionsService.RemoveBrewPackage(ctx, packageName)
}

func (s *serviceImpl) UpdateBrewPackage(ctx context.Context, packageName string) string {
	return s.actionsService.UpdateBrewPackage(ctx, packageName)
}

func (s *serviceImpl) UpdateSelectedBrewPackages(ctx context.Context, packageNames []string) string {
	return s.actionsService.UpdateSelectedBrewPackages(ctx, packageNames)
}

func (s *serviceImpl) UpdateAllBrewPackages(ctx context.Context) string {
	return s.actionsService.UpdateAllBrewPackages(ctx)
}

// Tap methods
func (s *serviceImpl) TapBrewRepository(ctx context.Context, repositoryName string) string {
	return s.tapService.TapBrewRepository(ctx, repositoryName)
}

func (s *serviceImpl) UntapBrewRepository(ctx context.Context, repositoryName string) string {
	return s.tapService.UntapBrewRepository(ctx, repositoryName)
}

// Package info methods - these can be extracted to a separate module later
func (s *serviceImpl) GetBrewPackageInfoAsJson(packageName string) map[string]interface{} {
	output, err := s.executor.Run("info", "--json=v2", packageName)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("Failed to get package info: %v", err),
		}
	}

	outputStr := strings.TrimSpace(string(output))
	jsonOutput, warnings, err := s.extractJSON(outputStr)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("Failed to extract JSON from package info: %v", err),
		}
	}

	if warnings != "" && s.logFunc != nil {
		s.logFunc(fmt.Sprintf("Homebrew warnings in package info for %s: %s", packageName, warnings))
	}

	var result struct {
		Formulae []map[string]interface{} `json:"formulae"`
		Casks    []map[string]interface{} `json:"casks"`
	}
	if err := json.Unmarshal([]byte(jsonOutput), &result); err != nil {
		return map[string]interface{}{
			"error": "Failed to parse package info",
		}
	}

	if len(result.Formulae) > 0 {
		return result.Formulae[0]
	}

	if len(result.Casks) > 0 {
		caskInfo := result.Casks[0]
		// Normalize cask data
		if conflictsObj, ok := caskInfo["conflicts_with"].(map[string]interface{}); ok {
			if caskConflicts, ok := conflictsObj["cask"].([]interface{}); ok {
				caskInfo["conflicts_with"] = caskConflicts
			} else {
				caskInfo["conflicts_with"] = []interface{}{}
			}
		}
		dependencies := []string{}
		if dependsOn, ok := caskInfo["depends_on"].(map[string]interface{}); ok {
			if formulaDeps, ok := dependsOn["formula"].([]interface{}); ok {
				for _, dep := range formulaDeps {
					if depStr, ok := dep.(string); ok {
						dependencies = append(dependencies, depStr)
					}
				}
			}
		}
		caskInfo["dependencies"] = dependencies
		return caskInfo
	}

	return map[string]interface{}{
		"error": "No package info found",
	}
}

func (s *serviceImpl) GetBrewPackageInfo(packageName string) string {
	output, err := s.executor.Run("info", packageName)
	if err != nil {
		return fmt.Sprintf("Error: Failed to get package info: %v", err)
	}
	return string(output)
}

func (s *serviceImpl) GetInstalledDependencies(packageName string) []string {
	output, err := s.executor.Run("deps", packageName, "--installed")
	if err != nil {
		return []string{}
	}
	raw := strings.TrimSpace(string(output))
	if raw == "" {
		return []string{}
	}
	lines := strings.Split(raw, "\n")
	deps := make([]string, 0, len(lines))
	for _, line := range lines {
		dep := strings.TrimSpace(line)
		if dep != "" {
			deps = append(deps, dep)
		}
	}
	return deps
}

func (s *serviceImpl) RunBrewDoctor() string {
	output, err := s.executor.Run("doctor")
	outputStr := string(output)
	if err != nil {
		if strings.Contains(outputStr, "Please note that these warnings are just used to help the Homebrew maintainers") ||
			strings.Contains(outputStr, "Warning:") ||
			strings.Contains(outputStr, "Your system is ready to brew") {
			return outputStr
		}
		return fmt.Sprintf("Error running brew doctor: %v\n\nOutput:\n%s", err, outputStr)
	}
	return outputStr
}

func (s *serviceImpl) GetDeprecatedFormulae(doctorOutput string) []string {
	var deprecated []string
	lines := strings.Split(doctorOutput, "\n")
	inDeprecatedSection := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.Contains(trimmed, "Some installed formulae are deprecated or disabled") ||
			strings.Contains(trimmed, "You should find replacements for the following formulae") {
			inDeprecatedSection = true
			continue
		}

		if inDeprecatedSection {
			if strings.HasPrefix(line, "  ") && trimmed != "" {
				formula := strings.TrimSpace(trimmed)
				formula = strings.TrimRight(formula, ":")
				if formula != "" {
					deprecated = append(deprecated, formula)
				}
			} else if trimmed == "" {
				continue
			} else if !strings.HasPrefix(line, " ") {
				break
			}
		}
	}

	return deprecated
}

func (s *serviceImpl) GetBrewCleanupDryRun() (string, error) {
	output, err := s.executor.RunWithTimeout(120*time.Second, "cleanup", "--dry-run")
	// Don't discard output on error — brew cleanup --dry-run often exits non-zero
	// due to warnings but still produces valid output with the summary line.
	if err != nil && len(output) == 0 {
		return "", fmt.Errorf("failed to run brew cleanup --dry-run: %w", err)
	}

	outputStr := string(output)
	lines := strings.Split(outputStr, "\n")
	for _, line := range lines {
		if strings.Contains(line, "would free approximately") {
			re := regexp.MustCompile(`approximately ([\d.]+\s*(MB|GB|KB|B))`)
			matches := re.FindStringSubmatch(line)
			if len(matches) > 1 {
				return matches[1], nil
			}
		}
	}

	return "0B", nil
}

func (s *serviceImpl) RunBrewCleanupDryRun() string {
	output, err := s.executor.RunWithTimeout(120*time.Second, "cleanup", "--dry-run")
	if err != nil {
		return fmt.Sprintf("Error running brew cleanup --dry-run: %v\n\nOutput:\n%s", err, string(output))
	}
	return string(output)
}

func (s *serviceImpl) RunBrewCleanup() string {
	output, err := s.executor.Run("cleanup")
	if err != nil {
		return fmt.Sprintf("Error running brew cleanup: %v\n\nOutput:\n%s", err, string(output))
	}
	return string(output)
}

func (s *serviceImpl) GetHomebrewVersion() (string, error) {
	output, err := s.executor.Run("--version")
	if err != nil {
		return "", fmt.Errorf("failed to get Homebrew version: %w", err)
	}

	outputStr := strings.TrimSpace(string(output))
	lines := strings.Split(outputStr, "\n")
	if len(lines) > 0 {
		parts := strings.Fields(lines[0])
		if len(parts) >= 2 {
			return parts[1], nil
		}
		return lines[0], nil
	}
	return outputStr, nil
}

func (s *serviceImpl) CheckHomebrewUpdate() (map[string]interface{}, error) {
	currentVersion, err := s.GetHomebrewVersion()
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"currentVersion": currentVersion,
		"isUpToDate":     true,
		"latestVersion":  currentVersion,
	}

	// Check Homebrew's git repository status
	brewDir := ""
	if runtime.GOOS == "darwin" {
		// Check for Workbrew first (enterprise users)
		if _, err := os.Stat("/opt/workbrew"); err == nil {
			brewDir = "/opt/workbrew"
		} else if runtime.GOARCH == "arm64" {
			brewDir = "/opt/homebrew"
		} else {
			brewDir = "/usr/local"
		}
	}

	if brewDir != "" {
		gitDir := fmt.Sprintf("%s/.git", brewDir)
		if _, err := os.Stat(gitDir); err == nil {
			cmd := exec.Command("git", "-C", brewDir, "rev-list", "--count", "HEAD..origin/HEAD")
			cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)
			behindOutput, _ := cmd.CombinedOutput()

			behindCount := strings.TrimSpace(string(behindOutput))
			if behindCount != "" && behindCount != "0" {
				cmd = exec.Command("git", "-C", brewDir, "describe", "--tags", "origin/HEAD")
				cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)
				latestTag, _ := cmd.CombinedOutput()
				latestVersion := strings.TrimSpace(string(latestTag))

				if latestVersion != "" {
					result["isUpToDate"] = false
					result["latestVersion"] = latestVersion
				} else {
					result["isUpToDate"] = false
					result["latestVersion"] = "latest"
				}
			}
		}
	}

	return result, nil
}

func (s *serviceImpl) UpdateHomebrew(ctx context.Context) string {
	startMessage := s.getBackendMsg("homebrewUpdateStart", map[string]string{})
	s.eventEmitter.Emit("homebrewUpdateProgress", startMessage)

	cmd := exec.Command(s.brewPath, "update")
	cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("homebrewUpdateProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("homebrewUpdateProgress", errorMsg)
		return errorMsg
	}

	if err := cmd.Start(); err != nil {
		errorMsg := s.getBackendMsg("errorStartingHomebrewUpdate", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("homebrewUpdateProgress", errorMsg)
		return errorMsg
	}

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("homebrewUpdateProgress", s.getBackendMsg("homebrewUpdateOutput", map[string]string{"line": line}))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("homebrewUpdateProgress", s.getBackendMsg("homebrewUpdateWarning", map[string]string{"line": line}))
			}
		}
	}()

	err = cmd.Wait()
	var finalMessage string
	if err != nil {
		finalMessage = s.getBackendMsg("homebrewUpdateFailed", map[string]string{"error": err.Error()})
	} else {
		finalMessage = s.getBackendMsg("homebrewUpdateSuccess", map[string]string{})
	}

	s.eventEmitter.Emit("homebrewUpdateComplete", finalMessage)
	return finalMessage
}

func (s *serviceImpl) GetHomebrewCaskVersion() (string, error) {
	if err := s.validateFunc(); err != nil {
		return "", fmt.Errorf("Homebrew validation failed: %v", err)
	}

	infoOutput, err := s.executor.Run("info", "--cask", "--json=v2", "wailbrew")
	if err != nil {
		return "", fmt.Errorf("failed to get Homebrew Cask info: %v", err)
	}

	var caskInfo struct {
		Casks []struct {
			Token   string `json:"token"`
			Version string `json:"version"`
		} `json:"casks"`
	}

	if err := json.Unmarshal(infoOutput, &caskInfo); err != nil {
		return "", fmt.Errorf("failed to parse Homebrew Cask JSON: %v", err)
	}

	if len(caskInfo.Casks) == 0 {
		return "", fmt.Errorf("wailbrew cask not found in Homebrew")
	}

	version := caskInfo.Casks[0].Version
	if version == "" {
		return "", fmt.Errorf("version not found in Homebrew Cask info")
	}

	return version, nil
}

func (s *serviceImpl) ExportBrewfile(filePath string) error {
	cmd := exec.Command(s.brewPath, "bundle", "dump", "--file="+filePath, "--force")
	cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("brew bundle dump failed: %v\nOutput: %s", err, string(output))
	}

	return nil
}
