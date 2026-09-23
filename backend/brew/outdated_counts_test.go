package brew

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetOutdatedCountsUsesEachModeAndSkipsPinned(t *testing.T) {
	brewPath := filepath.Join(t.TempDir(), "brew")
	brewScript := `#!/bin/sh
case " $* " in
  *" --greedy-auto-updates "*)
    printf '%s\n' '{"formulae":[{"pinned":false}],"casks":[{"pinned":false},{"pinned":false}]}' ;;
  *" --greedy "*)
    printf '%s\n' '{"formulae":[{"pinned":false}],"casks":[{"pinned":false},{"pinned":true}]}' ;;
  *)
    printf '%s\n' '{"formulae":[{"pinned":false},{"pinned":true}],"casks":[]}' ;;
esac
`
	if err := os.WriteFile(brewPath, []byte(brewScript), 0o755); err != nil {
		t.Fatal(err)
	}
	service := NewOutdatedService(
		NewExecutor(brewPath, nil, nil),
		func() error { return nil }, nil,
		ExtractJSONFromOutput, nil, nil,
		func() string { return OutdatedFlagNone },
		func() string { return "" }, nil,
	)
	counts := service.GetOutdatedCounts()
	for mode, want := range map[string]int{
		OutdatedFlagNone:             1,
		OutdatedFlagGreedy:           2,
		OutdatedFlagGreedyAutoUpdate: 3,
	} {
		if counts[mode] != want {
			t.Errorf("count for %q = %d, want %d", mode, counts[mode], want)
		}
	}
}
