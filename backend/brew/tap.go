package brew

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
)

// TapService provides tap/untap repository functionality
type TapService struct {
	brewPath       string
	getBrewEnvFunc func() []string
	getBackendMsg  func(string, map[string]string) string
	eventEmitter   EventEmitter
}

// NewTapService creates a new tap service
func NewTapService(
	brewPath string,
	getBrewEnvFunc func() []string,
	getBackendMsg func(string, map[string]string) string,
	eventEmitter EventEmitter,
) *TapService {
	return &TapService{
		brewPath:       brewPath,
		getBrewEnvFunc: getBrewEnvFunc,
		getBackendMsg:  getBackendMsg,
		eventEmitter:   eventEmitter,
	}
}

// TapBrewRepository taps a repository with live progress updates.
// repositoryURL is optional; when provided it is passed as the second argument to brew tap.
func (s *TapService) TapBrewRepository(ctx context.Context, repositoryName, repositoryURL string) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("tapStart", map[string]string{"name": repositoryName})
	s.eventEmitter.Emit("repositoryTapProgress", startMessage)

	args := []string{"tap", repositoryName}
	if url := strings.TrimSpace(repositoryURL); url != "" {
		args = append(args, url)
	}
	cmd := exec.Command(s.brewPath, args...)
	cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("repositoryTapProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("repositoryTapProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := s.getBackendMsg("errorStartingTap", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("repositoryTapProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("repositoryTapProgress", fmt.Sprintf("📦 %s", line))
			}
		}
	}()

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("repositoryTapProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for scanners to drain before calling cmd.Wait()
	wg.Wait()
	err = cmd.Wait()
	if err != nil {
		errorMsg := s.getBackendMsg("tapFailed", map[string]string{"name": repositoryName, "error": err.Error()})
		s.eventEmitter.Emit("repositoryTapProgress", errorMsg)
		s.eventEmitter.Emit("repositoryTapComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := s.getBackendMsg("tapSuccess", map[string]string{"name": repositoryName})
	s.eventEmitter.Emit("repositoryTapProgress", successMsg)
	s.eventEmitter.Emit("repositoryTapComplete", successMsg)
	return successMsg
}

// UntapBrewRepository untaps a repository with live progress updates
func (s *TapService) UntapBrewRepository(ctx context.Context, repositoryName string) string {
	// Emit initial progress
	startMessage := s.getBackendMsg("untapStart", map[string]string{"name": repositoryName})
	s.eventEmitter.Emit("repositoryUntapProgress", startMessage)

	cmd := exec.Command(s.brewPath, "untap", repositoryName)
	cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("repositoryUntapProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("repositoryUntapProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := s.getBackendMsg("errorStartingUntap", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("repositoryUntapProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("repositoryUntapProgress", fmt.Sprintf("🗑️ %s", line))
			}
		}
	}()

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("repositoryUntapProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for scanners to drain before calling cmd.Wait()
	wg.Wait()
	err = cmd.Wait()
	if err != nil {
		errorMsg := s.getBackendMsg("untapFailed", map[string]string{"name": repositoryName, "error": err.Error()})
		s.eventEmitter.Emit("repositoryUntapProgress", errorMsg)
		s.eventEmitter.Emit("repositoryUntapComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := s.getBackendMsg("untapSuccess", map[string]string{"name": repositoryName})
	s.eventEmitter.Emit("repositoryUntapProgress", successMsg)
	s.eventEmitter.Emit("repositoryUntapComplete", successMsg)
	return successMsg
}
