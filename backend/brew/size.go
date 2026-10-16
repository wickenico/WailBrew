package brew

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"
	"sync/atomic"

	"WailBrew/backend/system"
)

// SizeService provides package size calculation functionality
type SizeService struct {
	executor commandRunner
	cache    atomic.Pointer[sync.Map] // key: measured paths → string size
}

// NewSizeService creates a new size service
func NewSizeService(executor commandRunner) *SizeService {
	s := &SizeService{executor: executor}
	s.ClearCache()
	return s
}

// ClearCache invalidates all cached size entries (call after install/uninstall)
func (s *SizeService) ClearCache() {
	s.cache.Store(&sync.Map{})
}

const sizeWorkers = 10

type caskSizeInfo struct {
	Token     string          `json:"token"`
	FullToken string          `json:"full_token"`
	Installed json.RawMessage `json:"installed"`
	Artifacts []struct {
		Target    string          `json:"target"`
		Uninstall json.RawMessage `json:"uninstall"`
		Zap       json.RawMessage `json:"zap"`
	} `json:"artifacts"`
}

func (s *SizeService) installedCaskPaths() map[string][]string {
	output, err := s.executor.RunStdoutOnly("info", "--cask", "--json=v2", "--installed")
	if err != nil {
		return nil
	}
	var info struct {
		Casks []caskSizeInfo `json:"casks"`
	}
	if err := json.Unmarshal(output, &info); err != nil {
		return nil
	}
	caskroom, err := s.executor.RunStdoutOnly("--caskroom")
	if err != nil {
		return nil
	}
	paths := make(map[string][]string, len(info.Casks)*2)
	for _, cask := range info.Casks {
		version := extractCaskInstalledVersion(cask.Installed)
		if version == "" {
			continue
		}
		targets := []string{filepath.Join(strings.TrimSpace(string(caskroom)), cask.Token, version)}
		for _, artifact := range cask.Artifacts {
			if artifact.Target != "" {
				targets = append(targets, artifact.Target)
			} else if len(artifact.Uninstall) == 0 && len(artifact.Zap) == 0 {
				// Installers and older metadata may not identify all installed files.
				targets = nil
				break
			}
		}
		if len(targets) > 1 {
			paths[cask.Token] = targets
			paths[cask.FullToken] = targets
		}
	}
	return paths
}

type sizeJob struct {
	name   string
	isCask bool
}

type sizeResult struct {
	name string
	size string
}

// GetPackageSizes measures each installed package directly. du calls are
// dispatched to a worker pool and results are cached by path.
func (s *SizeService) GetPackageSizes(packageNames []string, isCask bool) map[string]string {
	sizes := make(map[string]string, len(packageNames))

	if len(packageNames) == 0 {
		return sizes
	}
	var caskPaths map[string][]string
	if isCask {
		caskPaths = s.installedCaskPaths()
	}

	// Dispatch du calls to a bounded worker pool
	jobs := make(chan sizeJob, len(packageNames))
	results := make(chan sizeResult, len(packageNames))

	var wg sync.WaitGroup
	for range sizeWorkers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobs {
				var size string
				if job.isCask {
					size = s.duSize(caskPaths[job.name]...)
				} else {
					size = s.CalculateFormulaSize(job.name)
				}
				results <- sizeResult{job.name, size}
			}
		}()
	}

	for _, name := range packageNames {
		jobs <- sizeJob{name: name, isCask: isCask}
	}
	close(jobs)
	wg.Wait()
	close(results)

	for r := range results {
		sizes[r.name] = r.size
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
	return s.duSize(s.installedCaskPaths()[caskName]...)
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

// duSize measures each target once without following links inside directories.
func (s *SizeService) duSize(paths ...string) string {
	cache := s.cache.Load()
	if cached, ok := cache.Load(strings.Join(paths, "\x00")); ok {
		return cached.(string)
	}
	roots := make([]string, 0, len(paths))
	for _, path := range paths {
		resolved, err := filepath.EvalSymlinks(path)
		if path == "" || err != nil {
			return "Unknown"
		}
		resolved, err = filepath.Abs(resolved)
		if err != nil {
			return "Unknown"
		}
		roots = append(roots, resolved)
	}
	slices.Sort(roots)
	unique := roots[:0]
	for _, root := range roots {
		covered := false
		for _, parent := range unique {
			if root == parent || strings.HasPrefix(root, parent+string(os.PathSeparator)) {
				covered = true
				break
			}
		}
		if !covered {
			unique = append(unique, root)
		}
	}
	roots = unique
	if len(roots) == 0 {
		return "Unknown"
	}

	key := strings.Join(roots, "\x00")
	if cached, ok := cache.Load(key); ok {
		return cached.(string)
	}

	args := append([]string{"-sch"}, roots...)
	cmd := system.RunHostCommand("du", args...)
	output, err := cmd.Output()
	if err != nil {
		return "Unknown"
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	parts := strings.Fields(lines[len(lines)-1])
	if len(parts) == 0 {
		return "Unknown"
	}
	size := parts[0]
	cache.Store(key, size)
	return size
}
