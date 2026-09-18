package brew

import (
	"fmt"
	"runtime"
	"testing"
)

func TestGetPackageSizesKeepsOtherSizesWhenOnePackageCannotBeMeasured(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("size paths are only available on macOS")
	}

	for _, tc := range []struct {
		name   string
		isCask bool
	}{
		{name: "formula"},
		{name: "cask", isCask: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := NewSizeService()
			names := make([]string, 51)
			for i := range names {
				names[i] = fmt.Sprintf("wailbrew-size-test-%s-%d", tc.name, i)
			}

			for i := range names {
				if i == 1 {
					continue
				}
				path := s.cellarPath(names[i])
				if tc.isCask {
					path = s.caskroomPath(names[i])
				}
				s.cache.Store(path, fmt.Sprintf("%dM", i+1))
			}

			sizes := s.GetPackageSizes(names, tc.isCask)
			if len(sizes) != len(names) {
				t.Fatalf("got %d sizes, want %d", len(sizes), len(names))
			}
			for _, i := range []int{0, 49, 50} {
				want := fmt.Sprintf("%dM", i+1)
				if got := sizes[names[i]]; got != want {
					t.Errorf("size for %s = %q, want %q", names[i], got, want)
				}
			}
			if got := sizes[names[1]]; got != "Unknown" {
				t.Errorf("size for missing package = %q, want Unknown", got)
			}
		})
	}
}
