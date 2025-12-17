package brew

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// SizeService provides package size calculation functionality
type SizeService struct {
	executor    *Executor
	logFunc     func(string)
	extractJSON func(string) (string, string, error)
}

// NewSizeService creates a new size service
func NewSizeService(executor *Executor, logFunc func(string), extractJSON func(string) (string, string, error)) *SizeService {
	return &SizeService{
		executor:    executor,
		logFunc:     logFunc,
		extractJSON: extractJSON,
	}
}

// GetPackageSizes fetches size information for packages with chunking support
func (s *SizeService) GetPackageSizes(packageNames []string, isCask bool) map[string]string {
	sizes := make(map[string]string)

	if len(packageNames) == 0 {
		return sizes
	}

	// Chunk size: process packages in batches to avoid command line length limits
	const chunkSize = 50

	for i := 0; i < len(packageNames); i += chunkSize {
		end := i + chunkSize
		if end > len(packageNames) {
			end = len(packageNames)
		}
		chunk := packageNames[i:end]

		// Build brew info command for this chunk
		args := []string{"info", "--json=v2"}
		if isCask {
			args = append(args, "--cask")
		}
		args = append(args, chunk...)

		output, err := s.executor.Run(args...)
		if err != nil {
			// If chunk fails, mark these packages as unknown and continue
			for _, name := range chunk {
				sizes[name] = "Unknown"
			}
			continue
		}

		// Extract JSON portion from output (handling potential Homebrew warnings)
		outputStr := strings.TrimSpace(string(output))
		jsonOutput, warnings, err := s.extractJSON(outputStr)
		if err != nil {
			// If JSON extraction fails, mark chunk as unknown and continue
			for _, name := range chunk {
				sizes[name] = "Unknown"
			}
			continue
		}

		// Log warnings if any were detected
		if warnings != "" && s.logFunc != nil {
			s.logFunc(fmt.Sprintf("Homebrew warnings in package sizes: %s", warnings))
		}

		// Parse JSON response
		var brewInfo struct {
			Formulae []struct {
				Name      string `json:"name"`
				Installed []struct {
					InstalledOnDemand bool  `json:"installed_on_demand"`
					UsedOptions       []any `json:"used_options"`
					BuiltAsBottle     bool  `json:"built_as_bottle"`
					Poured            bool  `json:"poured_from_bottle"`
					Time              int64 `json:"time"`
					RuntimeDeps       []any `json:"runtime_dependencies"`
					InstalledAsDep    bool  `json:"installed_as_dependency"`
					InstalledWithOpts []any `json:"installed_with_options"`
				} `json:"installed"`
			} `json:"formulae"`
			Casks []struct {
				Token     string `json:"token"`
				Installed string `json:"installed"`
			} `json:"casks"`
		}

		if err := json.Unmarshal([]byte(jsonOutput), &brewInfo); err != nil {
			// If JSON parsing fails, mark chunk as unknown and continue
			for _, name := range chunk {
				sizes[name] = "Unknown"
			}
			continue
		}

		// For formulae, calculate size from cellar
		if !isCask {
			for _, formula := range brewInfo.Formulae {
				size := s.CalculateFormulaSize(formula.Name)
				sizes[formula.Name] = size
			}
		} else {
			// For casks, calculate size from caskroom
			for _, cask := range brewInfo.Casks {
				size := s.CalculateCaskSize(cask.Token)
				sizes[cask.Token] = size
			}
		}
	}

	// Fill in any missing sizes
	for _, name := range packageNames {
		if _, exists := sizes[name]; !exists {
			sizes[name] = "Unknown"
		}
	}

	return sizes
}

// CalculateFormulaSize calculates the disk size of an installed formula
func (s *SizeService) CalculateFormulaSize(formulaName string) string {
	// Get formula path in cellar
	cellarPath := ""
	if runtime.GOOS == "darwin" {
		// Check for Workbrew first (enterprise users)
		if _, err := os.Stat("/opt/workbrew/Cellar"); err == nil {
			cellarPath = fmt.Sprintf("/opt/workbrew/Cellar/%s", formulaName)
		} else if runtime.GOARCH == "arm64" {
			cellarPath = fmt.Sprintf("/opt/homebrew/Cellar/%s", formulaName)
		} else {
			cellarPath = fmt.Sprintf("/usr/local/Cellar/%s", formulaName)
		}
	}

	// Use du command to get directory size
	cmd := exec.Command("du", "-sh", cellarPath)
	output, err := cmd.Output()
	if err != nil {
		return "Unknown"
	}

	// Parse du output (format: "SIZE	PATH")
	parts := strings.Fields(string(output))
	if len(parts) >= 1 {
		return parts[0]
	}

	return "Unknown"
}

// CalculateCaskSize calculates the disk size of an installed cask
func (s *SizeService) CalculateCaskSize(caskName string) string {
	// Get cask path in caskroom
	caskroomPath := ""
	if runtime.GOOS == "darwin" {
		// Check for Workbrew first (enterprise users)
		if _, err := os.Stat("/opt/workbrew/Caskroom"); err == nil {
			caskroomPath = fmt.Sprintf("/opt/workbrew/Caskroom/%s", caskName)
		} else if runtime.GOARCH == "arm64" {
			caskroomPath = fmt.Sprintf("/opt/homebrew/Caskroom/%s", caskName)
		} else {
			caskroomPath = fmt.Sprintf("/usr/local/Caskroom/%s", caskName)
		}
	}

	// Use du command to get directory size
	cmd := exec.Command("du", "-sh", caskroomPath)
	output, err := cmd.Output()
	if err != nil {
		return "Unknown"
	}

	// Parse du output (format: "SIZE	PATH")
	parts := strings.Fields(string(output))
	if len(parts) >= 1 {
		return parts[0]
	}

	return "Unknown"
}
