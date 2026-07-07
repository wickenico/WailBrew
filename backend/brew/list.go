package brew

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// isBrewDiagnosticLine reports whether a line is Homebrew diagnostic output
// (e.g. "Warning: Skipping <tap> ... because it is not trusted", "Error: ...",
// "==> ..."). Name-list commands use stdout-only capture, but some diagnostics
// can still appear on stdout and must not be treated as package/cask/tap names.
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

func parseNameListOutput(output []byte) [][]string {
	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return nil
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

func emptyCatalogError(kind string) [][]string {
	return [][]string{{"Error", fmt.Sprintf(
		"brew %s returned no entries. Homebrew may still be updating — try refreshing in a minute, or check Session Logs for warnings.",
		kind,
	)}}
}

func (s *ListService) fetchCatalogNames(kind string, args ...string) [][]string {
	output, err := s.executor.RunStdoutOnly(args...)
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf(
			"Failed to fetch all %s: %v. This often happens on fresh Homebrew installations. Try refreshing after a few minutes.",
			kind, err,
		)}}
	}

	results := parseNameListOutput(output)
	if len(results) > 0 {
		return results
	}

	// Retry once without cache in case a transient empty response was cached.
	output, err = s.executor.RunNoCacheStdoutOnly(args...)
	if err != nil {
		return emptyCatalogError(kind)
	}

	results = parseNameListOutput(output)
	if len(results) == 0 {
		return emptyCatalogError(kind)
	}
	return results
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
	results := s.fetchCatalogNames("formulae", "formulae")
	if len(results) == 1 && results[0][0] == "Error" {
		return results
	}

	// Initialize known packages on first call
	s.lockKnown()
	knownPkgs := s.knownPackages()
	if len(knownPkgs) == 0 {
		for _, entry := range results {
			knownPkgs["formula:"+entry[0]] = true
		}
		// Also add casks
		caskOutput, err := s.executor.RunStdoutOnly("casks")
		if err == nil {
			for _, entry := range parseNameListOutput(caskOutput) {
				knownPkgs["cask:"+entry[0]] = true
			}
		}
	}
	s.unlockKnown()

	return results
}

// GetBrewPackages retrieves the list of installed Homebrew packages
func (s *ListService) GetBrewPackages() [][]string {
	// Validate brew installation first
	if err := s.validateFunc(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	output, err := s.executor.RunStdoutOnly("list", "--formula", "--versions")
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

// extractCaskInstalledVersion reads the installed version from brew info JSON.
// The field may be a version string, an array of strings, or null.
func extractCaskInstalledVersion(installed json.RawMessage) string {
	if len(installed) == 0 || string(installed) == "null" {
		return ""
	}

	var version string
	if err := json.Unmarshal(installed, &version); err == nil && version != "" {
		return version
	}

	var versions []string
	if err := json.Unmarshal(installed, &versions); err == nil && len(versions) > 0 {
		return versions[0]
	}

	return ""
}

func (s *ListService) fillCaskInstalledVersions(caskNames []string, versionMap map[string]string) {
	args := []string{"info", "--cask", "--json=v2"}
	args = append(args, caskNames...)

	infoOutput, err := s.executor.Run(args...)
	if err != nil {
		for _, caskName := range caskNames {
			s.fillSingleCaskInstalledVersion(caskName, versionMap)
		}
		return
	}

	var caskInfo struct {
		Casks []struct {
			Token     string          `json:"token"`
			Installed json.RawMessage `json:"installed"`
		} `json:"casks"`
	}

	if err := json.Unmarshal(infoOutput, &caskInfo); err != nil {
		for _, caskName := range caskNames {
			s.fillSingleCaskInstalledVersion(caskName, versionMap)
		}
		return
	}

	for _, cask := range caskInfo.Casks {
		if version := extractCaskInstalledVersion(cask.Installed); version != "" {
			versionMap[cask.Token] = version
		}
	}
}

func (s *ListService) fillSingleCaskInstalledVersion(caskName string, versionMap map[string]string) {
	infoOutput, err := s.executor.Run("info", "--cask", "--json=v2", caskName)
	if err != nil {
		return
	}

	var caskInfo struct {
		Casks []struct {
			Installed json.RawMessage `json:"installed"`
		} `json:"casks"`
	}

	if err := json.Unmarshal(infoOutput, &caskInfo); err == nil && len(caskInfo.Casks) > 0 {
		if version := extractCaskInstalledVersion(caskInfo.Casks[0].Installed); version != "" {
			versionMap[caskName] = version
		}
	}
}

// GetBrewCasks retrieves the list of installed Homebrew casks
func (s *ListService) GetBrewCasks() [][]string {
	// Validate brew installation first
	if err := s.validateFunc(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	output, err := s.executor.RunStdoutOnly("list", "--cask", "--versions")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch installed casks: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var caskNames []string
	versionMap := make(map[string]string)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || isBrewDiagnosticLine(line) {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) >= 2 {
			caskNames = append(caskNames, parts[0])
			versionMap[parts[0]] = parts[1]
		} else if len(parts) == 1 && isPackageNameLine(parts[0]) {
			caskNames = append(caskNames, parts[0])
			versionMap[parts[0]] = ""
		}
	}

	if len(caskNames) == 0 {
		return [][]string{}
	}

	var missingVersion []string
	for _, name := range caskNames {
		if versionMap[name] == "" {
			missingVersion = append(missingVersion, name)
		}
	}
	if len(missingVersion) > 0 {
		s.fillCaskInstalledVersions(missingVersion, versionMap)
	}

	var casks [][]string
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
	return s.fetchCatalogNames("casks", "casks")
}

// GetBrewLeaves retrieves the list of leaf packages
func (s *ListService) GetBrewLeaves() []string {
	output, err := s.executor.RunWithTimeoutStdoutOnly(90*time.Second, "leaves")
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
	output, err := s.executor.RunStdoutOnly("tap")
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
