package brew

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// isBrewDiagnosticLine reports whether a line is Homebrew diagnostic output
// (e.g. "Warning: Skipping <tap> ... because it is not trusted", "Error: ...",
// "==> ...") that gets merged into command output via combined stdout/stderr.
// Homebrew 6 prints such warnings for untrusted taps and they must not be
// treated as package, cask or tap names.
func isBrewDiagnosticLine(line string) bool {
	lower := strings.ToLower(strings.TrimSpace(line))
	return strings.HasPrefix(lower, "warning:") ||
		strings.HasPrefix(lower, "error:") ||
		strings.HasPrefix(lower, "==>")
}

// isPackageNameLine reports whether a trimmed line looks like a single
// package/cask/tap name. Such names never contain whitespace, so any line with
// spaces (e.g. Homebrew warnings) is rejected.
func isPackageNameLine(line string) bool {
	if line == "" {
		return false
	}
	if strings.ContainsAny(line, " \t") {
		return false
	}
	return !isBrewDiagnosticLine(line)
}

// ListService provides package listing functionality
type ListService struct {
	executor      *Executor
	validateFunc  func() error
	knownPackages func() map[string]bool
	lockKnown     func()
	unlockKnown   func()
}

// NewListService creates a new list service
func NewListService(executor *Executor, validateFunc func() error, knownPackages func() map[string]bool, lockFunc func(), unlockFunc func()) *ListService {
	return &ListService{
		executor:      executor,
		validateFunc:  validateFunc,
		knownPackages: knownPackages,
		lockKnown:     lockFunc,
		unlockKnown:   unlockFunc,
	}
}

// GetAllBrewPackages retrieves all available brew packages
func (s *ListService) GetAllBrewPackages() [][]string {
	output, err := s.executor.Run("formulae")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch all packages: %v. This often happens on fresh Homebrew installations. Try refreshing after a few minutes.", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var results [][]string

	// Initialize known packages on first call
	s.lockKnown()
	knownPkgs := s.knownPackages()
	if len(knownPkgs) == 0 {
		// First time - initialize with current packages
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if isPackageNameLine(line) {
				knownPkgs["formula:"+line] = true
			}
		}
		// Also add casks
		caskOutput, err := s.executor.Run("casks")
		if err == nil {
			caskLines := strings.Split(strings.TrimSpace(string(caskOutput)), "\n")
			for _, line := range caskLines {
				line = strings.TrimSpace(line)
				if isPackageNameLine(line) {
					knownPkgs["cask:"+line] = true
				}
			}
		}
	}
	s.unlockKnown()

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if isPackageNameLine(line) {
			// For all packages (not installed), we don't have version or size yet
			results = append(results, []string{line, "", ""})
		}
	}

	return results
}

// GetBrewPackages retrieves the list of installed Homebrew packages
func (s *ListService) GetBrewPackages() [][]string {
	// Validate brew installation first
	if err := s.validateFunc(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	output, err := s.executor.Run("list", "--formula", "--versions")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch installed packages: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var packageNames []string
	packageVersions := make(map[string]string)
	installReasonByName := make(map[string]string)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || isBrewDiagnosticLine(line) {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) >= 2 {
			packageNames = append(packageNames, parts[0])
			packageVersions[parts[0]] = parts[1]
		} else if len(parts) == 1 {
			packageNames = append(packageNames, parts[0])
			packageVersions[parts[0]] = "Unknown"
		}
	}

	// Resolve install origin (on request vs as dependency) from Homebrew JSON metadata.
	infoOutput, infoErr := s.executor.Run("info", "--json=v2", "--formula", "--installed")
	if infoErr == nil {
		var info struct {
			Formulae []struct {
				Name      string `json:"name"`
				Installed []struct {
					InstalledOnRequest    bool `json:"installed_on_request"`
					InstalledAsDependency bool `json:"installed_as_dependency"`
				} `json:"installed"`
			} `json:"formulae"`
		}

		if err := json.Unmarshal(infoOutput, &info); err == nil {
			for _, f := range info.Formulae {
				reason := "unknown"
				if len(f.Installed) > 0 {
					switch {
					case f.Installed[0].InstalledOnRequest:
						reason = "on_request"
					case f.Installed[0].InstalledAsDependency:
						reason = "dependency"
					}
				}
				installReasonByName[f.Name] = reason
			}
		}
	}

	// Build result with name, version, and empty size (lazy loaded)
	var packages [][]string
	for _, name := range packageNames {
		version := packageVersions[name]
		reason := installReasonByName[name]
		if reason == "" {
			reason = "unknown"
		}
		packages = append(packages, []string{name, version, "", reason})
	}

	return packages
}

// GetBrewCasks retrieves the list of installed Homebrew casks
func (s *ListService) GetBrewCasks() [][]string {
	// Validate brew installation first
	if err := s.validateFunc(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	// Get list of cask names only (more reliable than --versions)
	output, err := s.executor.Run("list", "--cask")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch installed casks: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var caskNames []string
	for _, line := range lines {
		caskName := strings.TrimSpace(line)
		if isPackageNameLine(caskName) {
			caskNames = append(caskNames, caskName)
		}
	}

	if len(caskNames) == 0 {
		return [][]string{}
	}

	var casks [][]string
	versionMap := make(map[string]string)

	// Try to get all cask info at once first
	args := []string{"info", "--cask", "--json=v2"}
	args = append(args, caskNames...)

	infoOutput, err := s.executor.Run(args...)
	if err == nil {
		// Parse JSON to get versions
		var caskInfo struct {
			Casks []struct {
				Token   string `json:"token"`
				Version string `json:"version"`
			} `json:"casks"`
		}

		if err := json.Unmarshal(infoOutput, &caskInfo); err == nil {
			// Create a map for easy lookup
			for _, cask := range caskInfo.Casks {
				version := cask.Version
				if version == "" {
					version = "Unknown"
				}
				versionMap[cask.Token] = version
			}
		}
	}

	// If batch fetch fails, try individually
	if len(versionMap) == 0 {
		for _, caskName := range caskNames {
			infoOutput, err := s.executor.Run("info", "--cask", "--json=v2", caskName)
			if err != nil {
				versionMap[caskName] = "Unknown"
				continue
			}

			var caskInfo struct {
				Casks []struct {
					Version string `json:"version"`
				} `json:"casks"`
			}

			if err := json.Unmarshal(infoOutput, &caskInfo); err == nil && len(caskInfo.Casks) > 0 {
				version := caskInfo.Casks[0].Version
				if version == "" {
					version = "Unknown"
				}
				versionMap[caskName] = version
			} else {
				versionMap[caskName] = "Unknown"
			}
		}
	}

	// Build result array with name, version, and empty size (lazy loaded)
	for _, name := range caskNames {
		version := versionMap[name]
		if version == "" {
			version = "Unknown"
		}
		casks = append(casks, []string{name, version, ""})
	}

	return casks
}

// GetAllBrewCasks retrieves all available brew casks
func (s *ListService) GetAllBrewCasks() [][]string {
	output, err := s.executor.Run("casks")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch all casks: %v. This often happens on fresh Homebrew installations. Try refreshing after a few minutes.", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var results [][]string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if isPackageNameLine(line) {
			results = append(results, []string{line, "", ""})
		}
	}

	return results
}

// GetBrewLeaves retrieves the list of leaf packages
func (s *ListService) GetBrewLeaves() []string {
	output, err := s.executor.RunWithTimeout(90*time.Second, "leaves")
	if err != nil {
		return []string{fmt.Sprintf("Error: %v", err)}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return []string{}
	}

	lines := strings.Split(outputStr, "\n")
	var results []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if isPackageNameLine(line) {
			results = append(results, line)
		}
	}

	return results
}

// GetBrewTaps retrieves the list of tapped repositories
func (s *ListService) GetBrewTaps() [][]string {
	output, err := s.executor.Run("tap")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch repositories: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return [][]string{}
	}

	trustMap := s.getTapTrustMap()

	lines := strings.Split(outputStr, "\n")
	var taps [][]string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if isPackageNameLine(line) {
			trusted := ""
			if v, ok := trustMap[line]; ok {
				if v {
					trusted = "true"
				} else {
					trusted = "false"
				}
			}
			taps = append(taps, []string{line, "Active", trusted})
		}
	}

	return taps
}

// getTapTrustMap returns a map of tap name -> trusted state using the Homebrew 6
// `brew tap-info` trusted field. Taps absent from the map have unknown trust
// (e.g. on older Homebrew versions that don't expose the field), in which case
// the UI omits any trust indicator.
func (s *ListService) getTapTrustMap() map[string]bool {
	trustMap := make(map[string]bool)

	output, err := s.executor.Run("tap-info", "--installed", "--json=v1")
	if err != nil {
		return trustMap
	}

	jsonOutput, _, err := ExtractJSONFromOutput(string(output))
	if err != nil {
		return trustMap
	}

	var taps []struct {
		Name    string `json:"name"`
		Trusted *bool  `json:"trusted"`
	}
	if err := json.Unmarshal([]byte(jsonOutput), &taps); err != nil {
		return trustMap
	}

	for _, tap := range taps {
		if tap.Name != "" && tap.Trusted != nil {
			trustMap[tap.Name] = *tap.Trusted
		}
	}

	return trustMap
}

// GetBrewTapInfo retrieves information about a tapped repository
func (s *ListService) GetBrewTapInfo(repositoryName string) string {
	output, err := s.executor.Run("tap-info", repositoryName)
	if err != nil {
		return fmt.Sprintf("Error: Failed to get tap info: %v", err)
	}

	return string(output)
}
