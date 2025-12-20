package brew

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

// DatabaseService provides database update and new package detection functionality
type DatabaseService struct {
	executor         *Executor
	knownPackages    map[string]bool
	knownPackagesMux sync.Mutex
	updateMutex      sync.Mutex
	lastUpdateTime   time.Time
}

// NewDatabaseService creates a new database service
func NewDatabaseService(executor *Executor) *DatabaseService {
	return &DatabaseService{
		executor:      executor,
		knownPackages: make(map[string]bool),
	}
}

// UpdateBrewDatabase updates the Homebrew formula database
// It uses a mutex to ensure only one update runs at a time and caches the result
// for 5 minutes to avoid redundant updates
func (s *DatabaseService) UpdateBrewDatabase() error {
	s.updateMutex.Lock()
	defer s.updateMutex.Unlock()

	// If we updated less than 5 minutes ago, skip the update
	if time.Since(s.lastUpdateTime) < 5*time.Minute {
		return nil
	}

	// Run brew update to refresh the local formula database
	_, err := s.executor.RunWithTimeout(60*time.Second, "update")

	// Update the timestamp even if there was an error, to avoid hammering
	// the update command if there's a persistent issue
	s.lastUpdateTime = time.Now()

	// Clear cache after database update so outdated checks get fresh data
	// This ensures that brew outdated commands see the newly updated database
	if err == nil {
		s.executor.ClearCache()
	}

	return err
}

// UpdateBrewDatabaseWithOutput updates the Homebrew formula database and returns the output
// This version captures the output to detect new packages
func (s *DatabaseService) UpdateBrewDatabaseWithOutput() (string, error) {
	s.updateMutex.Lock()
	defer s.updateMutex.Unlock()

	// If we updated less than 5 minutes ago, skip the update
	if time.Since(s.lastUpdateTime) < 5*time.Minute {
		return "", nil
	}

	// Run brew update to refresh the local formula database
	output, err := s.executor.RunWithTimeout(60*time.Second, "update")

	// Update the timestamp even if there was an error, to avoid hammering
	// the update command if there's a persistent issue
	s.lastUpdateTime = time.Now()

	// Clear cache after database update so outdated checks get fresh data
	// This ensures that brew outdated commands see the newly updated database
	if err == nil {
		s.executor.ClearCache()
	}

	return string(output), err
}

// ParseNewPackagesFromUpdateOutput parses brew update output to extract new formulae and casks
func (s *DatabaseService) ParseNewPackagesFromUpdateOutput(output string) *NewPackagesInfo {
	info := &NewPackagesInfo{
		NewFormulae: []string{},
		NewCasks:    []string{},
	}

	if output == "" {
		return info
	}

	lines := strings.Split(output, "\n")
	inNewFormulae := false
	inNewCasks := false

	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Detect section headers
		if strings.Contains(line, "==> New Formulae") {
			inNewFormulae = true
			inNewCasks = false
			continue
		}
		if strings.Contains(line, "==> New Casks") {
			inNewFormulae = false
			inNewCasks = true
			continue
		}
		// Stop when we hit another section
		if strings.HasPrefix(line, "==>") {
			inNewFormulae = false
			inNewCasks = false
			continue
		}

		// Parse package names (format: "package-name: Description")
		if inNewFormulae || inNewCasks {
			// Extract package name (everything before the colon)
			parts := strings.SplitN(line, ":", 2)
			if len(parts) > 0 {
				packageName := strings.TrimSpace(parts[0])
				if packageName != "" {
					if inNewFormulae {
						info.NewFormulae = append(info.NewFormulae, packageName)
					} else if inNewCasks {
						info.NewCasks = append(info.NewCasks, packageName)
					}
				}
			}
		}
	}

	return info
}

// CheckForNewPackages checks for new packages and returns information about newly discovered ones
func (s *DatabaseService) CheckForNewPackages() (*NewPackagesInfo, error) {
	// Get current list of all packages
	allFormulae, err := s.executor.Run("formulae")
	if err != nil {
		return nil, fmt.Errorf("failed to get formulae list: %w", err)
	}

	allCasks, err := s.executor.Run("casks")
	if err != nil {
		return nil, fmt.Errorf("failed to get casks list: %w", err)
	}

	// Parse current packages
	currentPackages := make(map[string]bool)

	formulaeLines := strings.Split(strings.TrimSpace(string(allFormulae)), "\n")
	for _, line := range formulaeLines {
		name := strings.TrimSpace(line)
		if name != "" {
			currentPackages["formula:"+name] = true
		}
	}

	caskLines := strings.Split(strings.TrimSpace(string(allCasks)), "\n")
	for _, line := range caskLines {
		name := strings.TrimSpace(line)
		if name != "" {
			currentPackages["cask:"+name] = true
		}
	}

	// Compare with known packages
	s.knownPackagesMux.Lock()
	defer s.knownPackagesMux.Unlock()

	newInfo := &NewPackagesInfo{
		NewFormulae: []string{},
		NewCasks:    []string{},
	}

	// If knownPackages is empty, this is the first call - initialize it
	// and don't report all packages as "new"
	if len(s.knownPackages) == 0 {
		s.knownPackages = currentPackages
		return newInfo, nil
	}

	// Find new packages
	for pkg := range currentPackages {
		if !s.knownPackages[pkg] {
			// This is a new package
			if strings.HasPrefix(pkg, "formula:") {
				newInfo.NewFormulae = append(newInfo.NewFormulae, strings.TrimPrefix(pkg, "formula:"))
			} else if strings.HasPrefix(pkg, "cask:") {
				newInfo.NewCasks = append(newInfo.NewCasks, strings.TrimPrefix(pkg, "cask:"))
			}
		}
	}

	// Update known packages
	s.knownPackages = currentPackages

	return newInfo, nil
}

// UpdateKnownPackages updates the known packages map with new packages
func (s *DatabaseService) UpdateKnownPackages(newFormulae []string, newCasks []string) {
	s.knownPackagesMux.Lock()
	defer s.knownPackagesMux.Unlock()

	for _, formula := range newFormulae {
		s.knownPackages["formula:"+formula] = true
	}
	for _, cask := range newCasks {
		s.knownPackages["cask:"+cask] = true
	}
}
