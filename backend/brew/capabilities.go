package brew

import "sync"

// Capabilities describes optional Homebrew features that WailBrew must know
// about before acting, rather than after a command has already failed.
//
// These are probed, never derived from a version number. `brew trust` shipped in
// 5.1.15 — the last 5.x release — so the feature boundary sits inside a major
// version, not between two. Real installs also report versions like
// "6.0.15-73-g7d75aaa", and WailBrew supports Workbrew, a fork with its own
// numbering. Asking what an install can do is reliable; asking what it is, is not.
type Capabilities struct {
	SupportsTrust bool
}

// CapabilityDetector resolves Capabilities once and caches the answer. The probe
// spawns Ruby and costs roughly 300ms, so it is deliberately lazy: nothing is
// executed until something asks.
type CapabilityDetector struct {
	runner commandRunner
	once   sync.Once
	caps   Capabilities
}

// NewCapabilityDetector creates a detector that probes through the given runner.
func NewCapabilityDetector(runner commandRunner) *CapabilityDetector {
	return &CapabilityDetector{runner: runner}
}

// Capabilities returns the probed feature set, running the probe at most once.
func (d *CapabilityDetector) Capabilities() Capabilities {
	d.once.Do(func() {
		// `brew help <command>` exits 0 when the command exists and non-zero
		// when it does not, without performing any action.
		_, err := d.runner.Run("help", "trust")
		d.caps.SupportsTrust = err == nil
	})
	return d.caps
}

// TrustRemedy reports the tap the user should trust in order to recover from a
// failure, and whether offering that remedy makes sense on this installation.
//
// It returns false for unrelated failures, and also when the installed Homebrew
// has no `brew trust` command — offering a remedy that cannot be carried out is
// worse than showing the raw diagnostic.
func TrustRemedy(caps Capabilities, stderr string) (string, bool) {
	if !caps.SupportsTrust || !IsUntrustedTapError(stderr) {
		return "", false
	}

	tap := ExtractUntrustedTap(stderr)
	if tap == "" {
		return "", false
	}
	return tap, true
}
