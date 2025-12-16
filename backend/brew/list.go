package brew

import (
	"encoding/json"
	"fmt"
	"strings"
)

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
			if line != "" {
				knownPkgs["formula:"+line] = true
			}
		}
		// Also add casks
		caskOutput, err := s.executor.Run("casks")
		if err == nil {
			caskLines := strings.Split(strings.TrimSpace(string(caskOutput)), "\n")
			for _, line := range caskLines {
				line = strings.TrimSpace(line)
				if line != "" {
					knownPkgs["cask:"+line] = true
				}
			}
		}
	}
	s.unlockKnown()

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
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

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
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

	// Build result with name, version, and empty size (lazy loaded)
	var packages [][]string
	for _, name := range packageNames {
		version := packageVersions[name]
		packages = append(packages, []string{name, version, ""})
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
		if caskName != "" {
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

// GetBrewLeaves retrieves the list of leaf packages
func (s *ListService) GetBrewLeaves() []string {
	output, err := s.executor.Run("leaves")
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
		if line != "" {
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

	lines := strings.Split(outputStr, "\n")
	var taps [][]string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			taps = append(taps, []string{line, "Active"})
		}
	}

	return taps
}

// GetBrewTapInfo retrieves information about a tapped repository
func (s *ListService) GetBrewTapInfo(repositoryName string) string {
	output, err := s.executor.Run("tap-info", repositoryName)
	if err != nil {
		return fmt.Sprintf("Error: Failed to get tap info: %v", err)
	}

	return string(output)
}
