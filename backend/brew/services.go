package brew

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"sync"

	"WailBrew/backend/system"
)

// ServiceEntry represents a single Homebrew-managed background service as
// reported by `brew services list --json`.
type ServiceEntry struct {
	Name     string `json:"name"`
	Status   string `json:"status"`
	User     string `json:"user"`
	File     string `json:"file"`
	ExitCode *int   `json:"exit_code"`
}

// ServicesService provides management of Homebrew background services (launchd).
type ServicesService struct {
	executor       *Executor
	brewPath       string
	getBrewEnvFunc func() []string
	getBackendMsg  func(string, map[string]string) string
	eventEmitter   EventEmitter
}

// NewServicesService creates a new services service.
func NewServicesService(
	executor *Executor,
	brewPath string,
	getBrewEnvFunc func() []string,
	getBackendMsg func(string, map[string]string) string,
	eventEmitter EventEmitter,
) *ServicesService {
	return &ServicesService{
		executor:       executor,
		brewPath:       brewPath,
		getBrewEnvFunc: getBrewEnvFunc,
		getBackendMsg:  getBackendMsg,
		eventEmitter:   eventEmitter,
	}
}

// GetBrewServices returns all Homebrew-managed services as rows of
// [name, status, user]. Status is dynamic, so the underlying command is run
// without the shared cache.
func (s *ServicesService) GetBrewServices() [][]string {
	output, err := s.executor.RunNoCache("services", "list", "--json")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch services: %v", err)}}
	}

	jsonOutput, _, err := ExtractJSONFromOutput(string(output))
	if err != nil {
		// No JSON usually means there are no services at all.
		return [][]string{}
	}

	var entries []ServiceEntry
	if err := json.Unmarshal([]byte(jsonOutput), &entries); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to parse services: %v", err)}}
	}

	services := make([][]string, 0, len(entries))
	for _, entry := range entries {
		if entry.Name == "" {
			continue
		}
		status := entry.Status
		if status == "" {
			status = "unknown"
		}
		services = append(services, []string{entry.Name, status, entry.User})
	}

	return services
}

// GetBrewServiceInfo returns the raw `brew services info <name>` output for the
// detail panel.
func (s *ServicesService) GetBrewServiceInfo(name string) string {
	output, err := s.executor.Run("services", "info", name)
	if err != nil {
		return fmt.Sprintf("Error: Failed to get service info: %v", err)
	}
	return string(output)
}

// GetBrewServicePid returns the PID of a running service, or 0 if it is not
// running or has no PID. `brew services list --json` omits the PID, so this
// queries `brew services info <name> --json`.
func (s *ServicesService) GetBrewServicePid(name string) int {
	output, err := s.executor.RunNoCache("services", "info", name, "--json")
	if err != nil {
		return 0
	}

	jsonOutput, _, err := ExtractJSONFromOutput(string(output))
	if err != nil {
		return 0
	}

	var entries []struct {
		Pid *int `json:"pid"`
	}
	if err := json.Unmarshal([]byte(jsonOutput), &entries); err != nil {
		return 0
	}

	if len(entries) > 0 && entries[0].Pid != nil {
		return *entries[0].Pid
	}
	return 0
}

// StartBrewService starts a service and registers it to launch at login.
func (s *ServicesService) StartBrewService(ctx context.Context, name string) string {
	return s.runServiceAction(ctx, "start", name)
}

// StopBrewService stops a service and unregisters it.
func (s *ServicesService) StopBrewService(ctx context.Context, name string) string {
	return s.runServiceAction(ctx, "stop", name)
}

// RestartBrewService stops then starts a service.
func (s *ServicesService) RestartBrewService(ctx context.Context, name string) string {
	return s.runServiceAction(ctx, "restart", name)
}

// RunBrewService runs a service without registering it to launch at login
// (handy for debugging).
func (s *ServicesService) RunBrewService(ctx context.Context, name string) string {
	return s.runServiceAction(ctx, "run", name)
}

// runServiceAction executes `brew services <action> <name>` while streaming
// live output via the shared serviceActionProgress / serviceActionComplete
// events, mirroring the tap/untap flow.
func (s *ServicesService) runServiceAction(ctx context.Context, action, name string) string {
	msgParams := map[string]string{"action": action, "name": name}
	startMessage := s.getBackendMsg("serviceStart", msgParams)
	s.eventEmitter.Emit("serviceActionProgress", startMessage)

	cmd := exec.CommandContext(ctx, s.brewPath, "services", action, name)
	system.ApplyEnvironment(cmd, s.getBrewEnvFunc())

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("serviceActionProgress", errorMsg)
		s.eventEmitter.Emit("serviceActionComplete", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := s.getBackendMsg("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("serviceActionProgress", errorMsg)
		s.eventEmitter.Emit("serviceActionComplete", errorMsg)
		return errorMsg
	}

	if err := cmd.Start(); err != nil {
		errorMsg := s.getBackendMsg("errorStartingService", map[string]string{"error": err.Error()})
		s.eventEmitter.Emit("serviceActionProgress", errorMsg)
		s.eventEmitter.Emit("serviceActionComplete", errorMsg)
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
				s.eventEmitter.Emit("serviceActionProgress", fmt.Sprintf("📦 %s", line))
			}
		}
	}()

	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				s.eventEmitter.Emit("serviceActionProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for scanners to drain before calling cmd.Wait()
	wg.Wait()
	err = cmd.Wait()
	if err != nil {
		errorMsg := s.getBackendMsg("serviceFailed", map[string]string{"action": action, "name": name, "error": err.Error()})
		s.eventEmitter.Emit("serviceActionProgress", errorMsg)
		s.eventEmitter.Emit("serviceActionComplete", errorMsg)
		return errorMsg
	}

	successMsg := s.getBackendMsg("serviceSuccess", msgParams)
	s.eventEmitter.Emit("serviceActionProgress", successMsg)
	s.eventEmitter.Emit("serviceActionComplete", successMsg)
	return successMsg
}
