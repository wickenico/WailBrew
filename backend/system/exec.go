package system

import (
	"os"
	"os/exec"
)

// IsFlatpak returns true if the application is running inside a Flatpak sandbox
func IsFlatpak() bool {
	_, err := os.Stat("/.flatpak-info")
	return err == nil
}

// ApplyEnvironment prepares an exec.Cmd with the given environment variables.
// If running inside a Flatpak, it wraps the command with flatpak-spawn --host
// and carefully passes only the extraEnv, discarding the sandbox's os.Environ()
// which would corrupt the host's execution environment.
func ApplyEnvironment(cmd *exec.Cmd, extraEnv []string) {
	if IsFlatpak() {
		args := []string{"--host"}
		
		// Pass specific environment variables directly
		for _, env := range extraEnv {
			args = append(args, "--env="+env)
		}
		
		// We use cmd.Path as the executable name to run on host
		args = append(args, cmd.Path)
		if len(cmd.Args) > 1 {
			args = append(args, cmd.Args[1:]...)
		}
		
		cmd.Path = "/usr/bin/flatpak-spawn"
		cmd.Args = append([]string{"flatpak-spawn"}, args...)
		// Do not set cmd.Env so it uses the stripped flatpak-spawn environment
	} else {
		cmd.Env = append(os.Environ(), extraEnv...)
	}
}

// RunHostCommand executes a simple host command (e.g. for du, git, open, sw_vers)
// using flatpak-spawn --host if inside a flatpak sandbox.
func RunHostCommand(name string, arg ...string) *exec.Cmd {
	if IsFlatpak() {
		args := append([]string{"--host", name}, arg...)
		return exec.Command("/usr/bin/flatpak-spawn", args...)
	}
	return exec.Command(name, arg...)
}
