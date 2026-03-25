package brew

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
)

// SizeService provides package size calculation functionality
type SizeService struct {
	executor    *Executor
	logFunc     func(string)
	extractJSON func(string) (string, string, error)
	cache       sync.Map // key: cellar/caskroom path → string size
}

// NewSizeService creates a new size service
func NewSizeService(executor *Executor, logFunc func(string), extractJSON func(string) (string, string, error)) *SizeService {
	return &SizeService{
		executor:    executor,
		logFunc:     logFunc,
		extractJSON: extractJSON,
	}
}

// ClearCache invalidates all cached size entries (call after install/uninstall)
func (s *SizeService) ClearCache() {
	s.cache.Range(func(k, _ any) bool {
		s.cache.Delete(k)
		return true
	})
}

const sizeWorkers = 10

type sizeJob struct {
	name   string
	isCask bool
}

type sizeResult struct {
	name string
	size string
}

// GetPackageSizes fetches size information for packages with chunking support.
// du calls are dispatched to a worker pool of sizeWorkers goroutines and results
// are cached by path so subsequent calls skip the subprocess entirely.
func (s *SizeService) GetPackageSizes(packageNames []string, isCask bool) map[string]string {
	sizes := make(map[string]string)

	if len(packageNames) == 0 {
		return sizes
	}

	// Chunk size: process packages in batches to avoid command line length limits
	const chunkSize = 50

	// Collect all names that need du measurement after brew info JSON parsing
	var toMeasure []string

	for i := 0; i < len(packageNames); i += chunkSize {
		end := i + chunkSize
		if end > len(packageNames) {
			end = len(packageNames)
		}
		chunk := packageNames[i:end]

		args := []string{"info", "--json=v2"}
		if isCask {
			args = append(args, "--cask")
		}
		args = append(args, chunk...)

		output, err := s.executor.Run(args...)
		if err != nil {
			for _, name := range chunk {
				sizes[name] = "Unknown"
			}
			continue
		}

		outputStr := strings.TrimSpace(string(output))
		jsonOutput, warnings, err := s.extractJSON(outputStr)
		if err != nil {
			for _, name := range chunk {
				sizes[name] = "Unknown"
			}
			continue
		}

		if warnings != "" && s.logFunc != nil {
			s.logFunc(fmt.Sprintf("Homebrew warnings in package sizes: %s", warnings))
		}

		var brewInfo struct {
			Formulae []struct {
				Name string `json:"name"`
			} `json:"formulae"`
			Casks []struct {
				Token string `json:"token"`
			} `json:"casks"`
		}

		if err := json.Unmarshal([]byte(jsonOutput), &brewInfo); err != nil {
			for _, name := range chunk {
				sizes[name] = "Unknown"
			}
			continue
		}

		if !isCask {
			for _, formula := range brewInfo.Formulae {
				toMeasure = append(toMeasure, formula.Name)
			}
		} else {
			for _, cask := range brewInfo.Casks {
				toMeasure = append(toMeasure, cask.Token)
			}
		}
	}

	if len(toMeasure) == 0 {
		for _, name := range packageNames {
			if _, exists := sizes[name]; !exists {
				sizes[name] = "Unknown"
			}
		}
		return sizes
	}

	// Dispatch du calls to a bounded worker pool
	jobs := make(chan sizeJob, len(toMeasure))
	results := make(chan sizeResult, len(toMeasure))

	var wg sync.WaitGroup
	for range sizeWorkers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobs {
				var size string
				if job.isCask {
					size = s.CalculateCaskSize(job.name)
				} else {
					size = s.CalculateFormulaSize(job.name)
				}
				results <- sizeResult{job.name, size}
			}
		}()
	}

	for _, name := range toMeasure {
		jobs <- sizeJob{name: name, isCask: isCask}
	}
	close(jobs)
	wg.Wait()
	close(results)

	for r := range results {
		sizes[r.name] = r.size
	}

	// Fill in any missing sizes
	for _, name := range packageNames {
		if _, exists := sizes[name]; !exists {
			sizes[name] = "Unknown"
		}
	}

	return sizes
}

// CalculateFormulaSize calculates the disk size of an installed formula.
// Results are cached by path to avoid redundant du subprocess calls.
func (s *SizeService) CalculateFormulaSize(formulaName string) string {
	cellarPath := s.cellarPath(formulaName)
	return s.duSize(cellarPath)
}

// CalculateCaskSize calculates the disk size of an installed cask.
// Results are cached by path to avoid redundant du subprocess calls.
func (s *SizeService) CalculateCaskSize(caskName string) string {
	caskroomPath := s.caskroomPath(caskName)
	return s.duSize(caskroomPath)
}

// cellarPath returns the Cellar path for a formula, respecting Workbrew and architecture.
func (s *SizeService) cellarPath(formulaName string) string {
	if runtime.GOOS != "darwin" {
		return ""
	}
	if _, err := os.Stat("/opt/workbrew/Cellar"); err == nil {
		return fmt.Sprintf("/opt/workbrew/Cellar/%s", formulaName)
	}
	if runtime.GOARCH == "arm64" {
		return fmt.Sprintf("/opt/homebrew/Cellar/%s", formulaName)
	}
	return fmt.Sprintf("/usr/local/Cellar/%s", formulaName)
}

// caskroomPath returns the Caskroom path for a cask, respecting Workbrew and architecture.
func (s *SizeService) caskroomPath(caskName string) string {
	if runtime.GOOS != "darwin" {
		return ""
	}
	if _, err := os.Stat("/opt/workbrew/Caskroom"); err == nil {
		return fmt.Sprintf("/opt/workbrew/Caskroom/%s", caskName)
	}
	if runtime.GOARCH == "arm64" {
		return fmt.Sprintf("/opt/homebrew/Caskroom/%s", caskName)
	}
	return fmt.Sprintf("/usr/local/Caskroom/%s", caskName)
}

// duSize runs `du -sh` on the given path, using a cached result when available.
func (s *SizeService) duSize(path string) string {
	if path == "" {
		return "Unknown"
	}

	if cached, ok := s.cache.Load(path); ok {
		return cached.(string)
	}

	cmd := exec.Command("du", "-sh", path)
	output, err := cmd.Output()
	if err != nil {
		s.cache.Store(path, "Unknown")
		return "Unknown"
	}

	parts := strings.Fields(string(output))
	size := "Unknown"
	if len(parts) >= 1 {
		size = parts[0]
	}

	s.cache.Store(path, size)
	return size
}
