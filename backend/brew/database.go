package brew

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

const (
	brewUpdateTimeout       = 5 * time.Minute
	brewUpdateInterval      = 5 * time.Minute
	brewUpdateRetryInterval = 30 * time.Second
)

// DatabaseService provides database update and new package detection functionality
type DatabaseService struct {
	executor         *Executor
	knownPackages    map[string]bool
	knownPackagesMux sync.Mutex
	updateMutex      sync.Mutex
	lastUpdateTime   time.Time
	lastUpdateErr    error
}

// NewDatabaseService creates a new database service
func NewDatabaseService(executor *Executor) *DatabaseService {
	return &DatabaseService{
		executor:      executor,
		knownPackages: make(map[string]bool),
	}
}

// UpdateBrewDatabase updates the Homebrew formula database
// It uses a mutex to ensure only one update runs at a time. Successful updates
// are cached for five minutes; failed attempts can be retried after 30 seconds.
func (s *DatabaseService) UpdateBrewDatabase() error {
	_, err := s.UpdateBrewDatabaseWithOutput()
	return err
}

// UpdateBrewDatabaseWithOutput updates the Homebrew formula database and returns the output
// This version captures the output to detect new packages
func (s *DatabaseService) UpdateBrewDatabaseWithOutput() (string, error) {
	s.updateMutex.Lock()
	defer s.updateMutex.Unlock()

	// Keep successful updates for five minutes. Retry failures sooner, while
	// preserving the error for callers during the short cooldown.
	interval := brewUpdateInterval
	if s.lastUpdateErr != nil {
		interval = brewUpdateRetryInterval
	}
	if time.Since(s.lastUpdateTime) < interval {
		return "", s.lastUpdateErr
	}

	// Run brew update to refresh the local formula database
	output, err := s.executor.RunWithTimeout(brewUpdateTimeout, "update")

	// Throttle both successes and failures, but allow failures to retry sooner.
	s.lastUpdateTime = time.Now()
	s.lastUpdateErr = err

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
	allFormulae, err := s.executor.RunStdoutOnly("formulae")
	if err != nil {
		return nil, fmt.Errorf("failed to get formulae list: %w", err)
	}

	allCasks, err := s.executor.RunStdoutOnly("casks")
	if err != nil {
		return nil, fmt.Errorf("failed to get casks list: %w", err)
	}

	// Parse current packages
	currentPackages := make(map[string]bool)

	formulaeLines := strings.Split(strings.TrimSpace(string(allFormulae)), "\n")
	for _, line := range formulaeLines {
		name := strings.TrimSpace(line)
		if isPackageNameLine(name) {
			currentPackages["formula:"+name] = true
		}
	}

	caskLines := strings.Split(strings.TrimSpace(string(allCasks)), "\n")
	for _, line := range caskLines {
		name := strings.TrimSpace(line)
		if isPackageNameLine(name) {
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
