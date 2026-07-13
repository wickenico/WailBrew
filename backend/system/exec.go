package system

import (
	"os"
	"os/exec"
)

// ApplyEnvironment prepares an exec.Cmd with the given environment variables.
func ApplyEnvironment(cmd *exec.Cmd, extraEnv []string) {
	cmd.Env = append(os.Environ(), extraEnv...)
}

// RunHostCommand executes a simple host command (e.g. for du, git, open, sw_vers).
func RunHostCommand(name string, arg ...string) *exec.Cmd {
	return exec.Command(name, arg...)
}
