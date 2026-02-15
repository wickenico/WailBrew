package brew

import (
	"encoding/json"
	"fmt"
	"strings"
)

// OutdatedService provides outdated package checking functionality
type OutdatedService struct {
	executor              *Executor
	validateFunc          func() error
	logFunc               func(string)
	extractJSON           func(string) (string, string, error)
	parseWarnings         func(string) map[string]string
	getSizes              func([]string, bool) map[string]string
	getOutdatedFlag       func() string
	getCustomOutdatedArgs func() string
}

// NewOutdatedService creates a new outdated service
func NewOutdatedService(
	executor *Executor,
	validateFunc func() error,
	logFunc func(string),
	extractJSON func(string) (string, string, error),
	parseWarnings func(string) map[string]string,
	getSizes func([]string, bool) map[string]string,
	getOutdatedFlag func() string,
	getCustomOutdatedArgs func() string,
) *OutdatedService {
	return &OutdatedService{
		executor:              executor,
		validateFunc:          validateFunc,
		logFunc:               logFunc,
		extractJSON:           extractJSON,
		parseWarnings:         parseWarnings,
		getSizes:              getSizes,
		getOutdatedFlag:       getOutdatedFlag,
		getCustomOutdatedArgs: getCustomOutdatedArgs,
	}
}

// GetBrewUpdatablePackages checks which packages have updates available using brew outdated
func (s *OutdatedService) GetBrewUpdatablePackages() [][]string {
	// Validate brew installation first
	if err := s.validateFunc(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	// Use brew outdated with JSON output for accurate detection
	// Use the configured outdated flag setting
	outdatedFlag := s.getOutdatedFlag()
	args := []string{"outdated", "--json=v2"}
	if outdatedFlag == "greedy" {
		args = append(args, "--greedy")
	} else if outdatedFlag == "greedy-auto-updates" {
		args = append(args, "--greedy-auto-updates")
	}
	// If outdatedFlag is "none", no additional flag is added

	// Append custom outdated args if configured
	customArgs := s.getCustomOutdatedArgs()
	if customArgs != "" {
		// Parse custom args and append them (split by spaces)
		customParts := strings.Fields(customArgs)
		args = append(args, customParts...)
	}

	output, err := s.executor.Run(args...)
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to check for updates: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	// If output is empty or "[]", no packages are outdated
	if outputStr == "" || outputStr == "[]" {
		return [][]string{}
	}

	// Extract JSON portion from output (in case there are warnings before the JSON)
	jsonOutput, warnings, err := s.extractJSON(outputStr)
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to extract JSON from brew outdated output: %v", err)}}
	}

	// Parse warnings to map them to specific packages
	warningMap := s.parseWarnings(warnings)

	// Log warnings if any were detected
	if warnings != "" && s.logFunc != nil {
		s.logFunc(fmt.Sprintf("Homebrew warnings detected:\n%s", warnings))
	}

	// Parse JSON response from brew outdated
	var brewOutdated struct {
		Formulae []struct {
			Name              string   `json:"name"`
			InstalledVersions []string `json:"installed_versions"`
			CurrentVersion    string   `json:"current_version"`
			Pinned            bool     `json:"pinned"`
			PinnedVersion     string   `json:"pinned_version"`
		} `json:"formulae"`
		Casks []struct {
			Name              string   `json:"name"`
			InstalledVersions []string `json:"installed_versions"`
			CurrentVersion    string   `json:"current_version"`
		} `json:"casks"`
	}

	if err := json.Unmarshal([]byte(jsonOutput), &brewOutdated); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to parse outdated packages: %v", err)}}
	}

	var updatablePackages [][]string
	var formulaeNames []string
	var caskNames []string

	// Process formulae (packages)
	for _, formula := range brewOutdated.Formulae {
		// Skip pinned packages as they won't be updated
		if formula.Pinned {
			continue
		}

		installedVersion := "unknown"
		if len(formula.InstalledVersions) > 0 {
			installedVersion = formula.InstalledVersions[0]
		}

		formulaeNames = append(formulaeNames, formula.Name)

		// Get warning for this package if any
		warning := ""
		if w, found := warningMap[formula.Name]; found {
			warning = w
		}

		updatablePackages = append(updatablePackages, []string{
			formula.Name,
			installedVersion,
			formula.CurrentVersion,
			"",        // size placeholder, will be filled below
			warning,   // warning message
			"formula", // package type
		})
	}

	// Process casks (applications)
	for _, cask := range brewOutdated.Casks {
		installedVersion := "unknown"
		if len(cask.InstalledVersions) > 0 {
			installedVersion = cask.InstalledVersions[0]
		}

		caskNames = append(caskNames, cask.Name)

		// Get warning for this cask if any
		warning := ""
		if w, found := warningMap[cask.Name]; found {
			warning = w
		}

		updatablePackages = append(updatablePackages, []string{
			cask.Name,
			installedVersion,
			cask.CurrentVersion,
			"",      // size placeholder, will be filled below
			warning, // warning message
			"cask",  // package type
		})
	}

	// Get size information for all packages
	formulaeSizes := s.getSizes(formulaeNames, false)
	caskSizes := s.getSizes(caskNames, true)

	// Fill in size information
	for i := range updatablePackages {
		name := updatablePackages[i][0]
		if size, found := formulaeSizes[name]; found {
			updatablePackages[i][3] = size
		} else if size, found := caskSizes[name]; found {
			updatablePackages[i][3] = size
		} else {
			updatablePackages[i][3] = "Unknown"
		}
	}

	return updatablePackages
}

// IsPackageCask checks if a package is a cask
func (s *OutdatedService) IsPackageCask(packageName string) bool {
	output, err := s.executor.Run("info", "--json=v2", packageName)
	if err != nil {
		return false
	}

	outputStr := strings.TrimSpace(string(output))
	jsonOutput, _, err := s.extractJSON(outputStr)
	if err != nil {
		return false
	}

	var result struct {
		Formulae []map[string]interface{} `json:"formulae"`
		Casks    []map[string]interface{} `json:"casks"`
	}
	if err := json.Unmarshal([]byte(jsonOutput), &result); err != nil {
		return false
	}

	// If found in casks but not in formulae, it's a cask
	return len(result.Casks) > 0 && len(result.Formulae) == 0
}

// IsAppAlreadyExistsError checks if the error is the "app already exists" error
func (s *OutdatedService) IsAppAlreadyExistsError(stderrOutput string) bool {
	return strings.Contains(stderrOutput, "It seems there is already an app at") ||
		strings.Contains(stderrOutput, "already an App at")
}

// ExtractFailedPackagesFromError extracts package names from "app already exists" errors
func (s *OutdatedService) ExtractFailedPackagesFromError(stderrOutput string) []string {
	var failedPackages []string
	lines := strings.Split(stderrOutput, "\n")
	for _, line := range lines {
		// Error format: "Error: package-name: It seems there is already an app at..."
		if strings.Contains(line, "It seems there is already an app at") ||
			strings.Contains(line, "already an App at") {
			// Try to extract package name
			// Format is typically: "Error: package-name: It seems..."
			parts := strings.Split(line, ":")
			if len(parts) >= 3 {
				// Format: "Error" : "package-name" : "It seems..."
				pkgName := strings.TrimSpace(parts[1])
				if pkgName != "" {
					failedPackages = append(failedPackages, pkgName)
				}
			} else if len(parts) >= 2 {
				// Fallback: "package-name: It seems..."
				pkgName := strings.TrimSpace(parts[0])
				if pkgName != "" && !strings.Contains(pkgName, "Error") {
					failedPackages = append(failedPackages, pkgName)
				}
			}
		}
	}
	return failedPackages
}
