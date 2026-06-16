package brew

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
)

// untrustedTapRe matches an "owner/repo" tap token in Homebrew trust error output.
var untrustedTapRe = regexp.MustCompile(`[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+`)

// IsUntrustedTapError reports whether brew output indicates the operation was
// blocked because a (non-official) tap is not trusted. Homebrew 6 requires
// explicit tap trust before loading/installing from third-party taps.
func IsUntrustedTapError(output string) bool {
	lower := strings.ToLower(output)
	return strings.Contains(lower, "not trusted") ||
		strings.Contains(lower, "untrusted tap") ||
		strings.Contains(lower, "untrusted formula") ||
		strings.Contains(lower, "untrusted cask") ||
		strings.Contains(lower, "brew trust") ||
		strings.Contains(lower, "require tap trust") ||
		strings.Contains(lower, "tap trust")
}

// ExtractUntrustedTap makes a best-effort attempt to pull the "owner/repo" tap
// token out of a Homebrew trust error message. Returns "" if none is found.
func ExtractUntrustedTap(output string) string {
	for _, line := range strings.Split(output, "\n") {
		lower := strings.ToLower(line)
		if !strings.Contains(lower, "trust") {
			continue
		}
		if match := untrustedTapRe.FindString(line); match != "" {
			// Ignore obvious false positives like file paths.
			if !strings.HasPrefix(match, "/") {
				return match
			}
		}
	}
	return ""
}

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
	var stderrOutput strings.Builder
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
				stderrOutput.WriteString(line)
				stderrOutput.WriteString("\n")
				s.eventEmitter.Emit("repositoryTapProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for scanners to drain before calling cmd.Wait()
	wg.Wait()
	err = cmd.Wait()
	if err != nil {
		stderrStr := stderrOutput.String()
		// Homebrew 6: tap may be blocked because it is not trusted. Surface a
		// distinct event so the UI can ask the user to trust it and retry.
		if IsUntrustedTapError(stderrStr) {
			tapName := ExtractUntrustedTap(stderrStr)
			if tapName == "" {
				tapName = repositoryName
			}
			s.eventEmitter.Emit("repositoryTapTrustRequired", tapName)
		}
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

// TrustBrewTap trusts a (non-official) tap so Homebrew 6 will load and install
// from it. Streams progress via the "repositoryTrustProgress" event.
func (s *TapService) TrustBrewTap(ctx context.Context, tapName string) string {
	startMessage := s.getBackendMsg("trustStart", map[string]string{"name": tapName})
	s.eventEmitter.Emit("repositoryTrustProgress", startMessage)

	cmd := exec.Command(s.brewPath, "trust", tapName)
	cmd.Env = append(os.Environ(), s.getBrewEnvFunc()...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("repositoryTrustProgress", errorMsg)
		s.eventEmitter.Emit("repositoryTrustComplete", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("repositoryTrustProgress", errorMsg)
		s.eventEmitter.Emit("repositoryTrustComplete", errorMsg)
		return errorMsg
	}

	if err := cmd.Start(); err != nil {
		errorMsg := s.getBackendMsg("errorStartingTrust", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("repositoryTrustProgress", errorMsg)
		s.eventEmitter.Emit("repositoryTrustComplete", errorMsg)
		return errorMsg
	}

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("repositoryTrustProgress", fmt.Sprintf("🔐 %s", line))
			}
		}
	}()

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("repositoryTrustProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	wg.Wait()
	err = cmd.Wait()
	if err != nil {
		errorMsg := s.getBackendMsg("trustFailed", map[string]string{"name": tapName, "error": err.Error()})
		s.eventEmitter.Emit("repositoryTrustProgress", errorMsg)
		s.eventEmitter.Emit("repositoryTrustComplete", errorMsg)
		return errorMsg
	}

	successMsg := s.getBackendMsg("trustSuccess", map[string]string{"name": tapName})
	s.eventEmitter.Emit("repositoryTrustProgress", successMsg)
	s.eventEmitter.Emit("repositoryTrustComplete", successMsg)
	return successMsg
}
