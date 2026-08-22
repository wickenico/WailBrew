package brew

import (
	"os/exec"
	"testing"
)

func TestRunStreamingCommand_Success(t *testing.T) {
	cmd := exec.Command("/bin/sh", "-c", "echo out1; echo err1 >&2; echo out2")

	var stdoutLines, stderrLines []string
	phase, stderrText, err := runStreamingCommand(cmd,
		func(line string) { stdoutLines = append(stdoutLines, line) },
		func(line string) { stderrLines = append(stderrLines, line) },
	)

	if phase != phaseNone {
		t.Fatalf("expected phaseNone, got %v (err=%v)", phase, err)
	}
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(stdoutLines) != 2 || stdoutLines[0] != "out1" || stdoutLines[1] != "out2" {
		t.Fatalf("unexpected stdout lines: %v", stdoutLines)
	}
	if len(stderrLines) != 1 || stderrLines[0] != "err1" {
		t.Fatalf("unexpected stderr lines: %v", stderrLines)
	}
	if stderrText != "err1\n" {
		t.Fatalf("unexpected stderrText: %q", stderrText)
	}
}

func TestRunStreamingCommand_RunFailure(t *testing.T) {
	cmd := exec.Command("/bin/sh", "-c", "echo boom >&2; exit 1")

	phase, stderrText, err := runStreamingCommand(cmd, nil, nil)

	if phase != phaseRun {
		t.Fatalf("expected phaseRun, got %v", phase)
	}
	if err == nil {
		t.Fatal("expected an error")
	}
	if stderrText != "boom\n" {
		t.Fatalf("unexpected stderrText: %q", stderrText)
	}
}

func TestRunStreamingCommand_StartFailure(t *testing.T) {
	cmd := exec.Command("/nonexistent-binary-should-not-exist")

	phase, _, err := runStreamingCommand(cmd, nil, nil)

	if phase != phaseStart {
		t.Fatalf("expected phaseStart, got %v", phase)
	}
	if err == nil {
		t.Fatal("expected an error")
	}
}
