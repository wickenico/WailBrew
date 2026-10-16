package brew

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func diskUsage(t *testing.T, paths ...string) string {
	t.Helper()
	output, err := exec.Command("du", append([]string{"-sch"}, paths...)...).Output()
	if err != nil {
		t.Fatalf("du failed: %v", err)
	}
	fields := strings.Fields(string(output))
	if len(fields) < 2 {
		t.Fatalf("unexpected du output: %q", output)
	}
	return fields[len(fields)-2]
}

func writeSizeFile(t *testing.T, path string, size int) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, make([]byte, size), 0644); err != nil {
		t.Fatal(err)
	}
}

func linkSizeFile(t *testing.T, source, target string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(source, target); err != nil {
		t.Fatal(err)
	}
}

func TestDuSizeSymlink(t *testing.T) {
	root := t.TempDir()
	app := filepath.Join(root, "Orca.app")
	writeSizeFile(t, filepath.Join(app, "orca"), 1024*1024)
	link := filepath.Join(root, "orca")
	linkSizeFile(t, app, link)
	s := NewSizeService(nil)
	want := diskUsage(t, app)
	if got := s.duSize(link); got != want {
		t.Fatalf("linked app size = %q, want %q", got, want)
	}
}

func TestDuSizeTargets(t *testing.T) {
	root := t.TempDir()
	app := filepath.Join(root, "Orca.app")
	binary := filepath.Join(app, "Contents", "MacOS", "orca")
	writeSizeFile(t, binary, 1024*1024)
	link := filepath.Join(root, "bin", "orca")
	linkSizeFile(t, binary, link)
	other := filepath.Join(root, "Orca.app-other")
	writeSizeFile(t, other, 1024*1024)
	s := NewSizeService(nil)
	want := diskUsage(t, app, other)
	if got := s.duSize(link, other, app, binary, app); got != want {
		t.Fatalf("overlapping targets size = %q, want %q", got, want)
	}
	// Links inside a measured directory must not pull in unrelated files.
	linkSizeFile(t, other, filepath.Join(app, "external"))
	s.ClearCache()
	want = diskUsage(t, app)
	if got := s.duSize(app); got != want {
		t.Fatalf("app with external link size = %q, want %q", got, want)
	}
}

func TestDuSizeCache(t *testing.T) {
	path := filepath.Join(t.TempDir(), "firefox")
	s := NewSizeService(nil)
	if got := s.duSize(path); got != "Unknown" {
		t.Fatalf("missing target size = %q", got)
	}
	writeSizeFile(t, path, 1024*1024)
	initial := diskUsage(t, path)
	if got := s.duSize(path); got != initial {
		t.Fatalf("size after creating target = %q, want %q", got, initial)
	}
	writeSizeFile(t, path, 4*1024*1024)
	if got := s.duSize(path); got != initial {
		t.Fatalf("cached size = %q, want %q", got, initial)
	}
	previousCache := s.cache.Load()
	service := &serviceImpl{executor: NewExecutor("", nil, nil), sizeService: s}
	service.ClearCache()
	// A measurement that started before clearing may still publish its result.
	previousCache.Store(path, initial)
	want := diskUsage(t, path)
	if got := s.duSize(path); got != want {
		t.Fatalf("refreshed size = %q, want %q", got, want)
	}
}

func TestGetCaskSizes(t *testing.T) {
	root := t.TempDir()
	caskroom := filepath.Join(root, "Caskroom")
	runner := &fakeRunner{stdout: map[string]string{"--caskroom": caskroom}}
	s := NewSizeService(runner)
	stage := filepath.Join(caskroom, "orca", "1.4.226")
	app := filepath.Join(root, "Custom Applications", "Orca.app")
	binary := filepath.Join(app, "Contents", "MacOS", "orca")
	writeSizeFile(t, binary, 1024*1024)
	linkSizeFile(t, app, filepath.Join(stage, "Orca.app"))
	writeSizeFile(t, filepath.Join(caskroom, "orca", "1.4.224", "old"), 8*1024*1024)
	tools := filepath.Join(caskroom, "android-platform-tools", "37.0.1")
	adb := filepath.Join(tools, "platform-tools", "adb")
	writeSizeFile(t, adb, 1024*1024)
	adbLink := filepath.Join(root, "bin", "adb")
	linkSizeFile(t, adb, adbLink)
	fontStage := filepath.Join(caskroom, "font-jetbrains-mono-nerd-font", "3.4.0")
	font := filepath.Join(root, "Library", "Fonts", "JetBrainsMonoNerdFont-Regular.ttf")
	writeSizeFile(t, font, 1024*1024)
	linkSizeFile(t, font, filepath.Join(fontStage, filepath.Base(font)))
	writeSizeFile(t, filepath.Join(caskroom, "firefox", "120.0", "metadata"), 1)
	writeSizeFile(t, filepath.Join(caskroom, "zoom", "6.0", "Zoom.pkg"), 1024)
	linkSizeFile(t, app, filepath.Join(caskroom, "visual-studio-code", "1.0", "Visual Studio Code.app"))
	runner.stdout["info --cask --json=v2 --installed"] = fmt.Sprintf(`{"casks":[
 {"token":"orca","full_token":"stablyai/orca/orca","installed":"1.4.226","artifacts":[{"app":["Orca.app"],"target":%q},{"binary":[%q],"target":%q}]},
 {"token":"android-platform-tools","full_token":"android-platform-tools","installed":"37.0.1","artifacts":[{"binary":[%q],"target":%q}]},
 {"token":"font-jetbrains-mono-nerd-font","full_token":"font-jetbrains-mono-nerd-font","installed":"3.4.0","artifacts":[{"font":["JetBrainsMonoNerdFont-Regular.ttf"],"target":%q}]},
 {"token":"firefox","full_token":"firefox","installed":"120.0","artifacts":[{"app":["Firefox.app"],"target":%q}]},
 {"token":"zoom","full_token":"zoom","installed":"6.0","artifacts":[{"pkg":["Zoom.pkg"]}]},
 {"token":"visual-studio-code","full_token":"visual-studio-code","installed":"1.0","artifacts":[{"app":["Visual Studio Code.app"]}]}
 ]}`, app, binary, binary, adb, adbLink, font, filepath.Join(root, "Firefox.app"))
	names := []string{"orca", "stablyai/orca/orca", "android-platform-tools", "font-jetbrains-mono-nerd-font", "firefox", "zoom", "visual-studio-code", "homebrew/cask/orca"}
	sizes := s.GetPackageSizes(names, true)
	for name, paths := range map[string][]string{
		"orca":                          {stage, app},
		"stablyai/orca/orca":            {stage, app},
		"android-platform-tools":        {tools},
		"font-jetbrains-mono-nerd-font": {fontStage, font},
	} {
		want := diskUsage(t, paths...)
		if got := sizes[name]; got != want {
			t.Errorf("size for %s = %q, want %q", name, got, want)
		}
	}
	for _, name := range []string{"firefox", "zoom", "visual-studio-code", "homebrew/cask/orca"} {
		if got := sizes[name]; got != "Unknown" {
			t.Errorf("size for %s = %q, want Unknown", name, got)
		}
	}
	if got := sizes["orca"]; got == diskUsage(t, filepath.Join(caskroom, "orca")) {
		t.Fatal("size includes an old version or omits the app")
	}
}

func TestGetCaskSizesReadFailure(t *testing.T) {
	const command = "info --cask --json=v2 --installed"
	for _, tc := range []struct {
		name    string
		output  string
		failing string
		err     error
	}{
		{name: "command", failing: command, err: errors.New("brew failed")},
		{name: "json", output: "not json"},
		{name: "caskroom", output: `{"casks":[]}`, failing: "--caskroom", err: errors.New("brew failed")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			runner := &fakeRunner{
				stdout: map[string]string{command: tc.output},
				errs:   map[string]error{tc.failing: tc.err},
			}
			caskroom := filepath.Join(t.TempDir(), "Caskroom")
			runner.stdout["--caskroom"] = caskroom
			s := NewSizeService(runner)
			stage := filepath.Join(caskroom, "firefox", "120.0")
			writeSizeFile(t, filepath.Join(stage, "Firefox.app", "firefox"), 1024*1024)
			if got := s.CalculateCaskSize("firefox"); got != "Unknown" {
				t.Fatalf("failed lookup size = %q, want Unknown", got)
			}
			runner.errs[tc.failing] = nil
			runner.stdout[command] = fmt.Sprintf(`{"casks":[{"token":"firefox","full_token":"firefox","installed":"120.0","artifacts":[{"app":["Firefox.app"],"target":%q}]}]}`, filepath.Join(stage, "Firefox.app"))
			if got := s.CalculateCaskSize("firefox"); got == "Unknown" {
				t.Fatal("failed lookup prevented a later measurement")
			}
		})
	}
}

func TestCaskSizeBrewPrefix(t *testing.T) {
	root := t.TempDir()
	caskroom := filepath.Join(root, "Caskroom")
	app := filepath.Join(caskroom, "firefox", "120.0", "Firefox.app")
	writeSizeFile(t, filepath.Join(app, "firefox"), 1024*1024)
	runner := &fakeRunner{stdout: map[string]string{
		"--caskroom":                        caskroom,
		"info --cask --json=v2 --installed": fmt.Sprintf(`{"casks":[{"token":"firefox","full_token":"firefox","installed":"120.0","artifacts":[{"app":["Firefox.app"],"target":%q}]}]}`, app),
	}}
	s := NewSizeService(runner)
	if got := s.CalculateCaskSize("firefox"); got == "Unknown" {
		t.Fatal("size lookup did not use Homebrew's Caskroom")
	}
}

func TestCaskSizeWithoutTargets(t *testing.T) {
	for _, tc := range []struct {
		name      string
		artifacts string
	}{
		{name: "empty", artifacts: `[]`},
		{name: "zap", artifacts: `[{"zap":[{"trash":"~/.firefox"}]}]`},
		{name: "uninstall", artifacts: `[{"uninstall":[{"pkgutil":"org.mozilla.firefox"}]}]`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			caskroom := filepath.Join(root, "Caskroom")
			runner := &fakeRunner{stdout: map[string]string{
				"--caskroom":                        caskroom,
				"info --cask --json=v2 --installed": fmt.Sprintf(`{"casks":[{"token":"firefox","full_token":"firefox","installed":"120.0","artifacts":%s}]}`, tc.artifacts),
			}}
			s := NewSizeService(runner)
			writeSizeFile(t, filepath.Join(caskroom, "firefox", "120.0", "metadata"), 1)
			if got := s.CalculateCaskSize("firefox"); got != "Unknown" {
				t.Fatalf("size without installed targets = %q, want Unknown", got)
			}
		})
	}
}

func TestGetPackageSizesKeepsOtherSizesWhenOnePackageCannotBeMeasured(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("formula paths are only available on macOS")
	}
	s := NewSizeService(nil)
	names := make([]string, 51)
	for i := range names {
		names[i] = fmt.Sprintf("wailbrew-size-test-%d", i)
		if i != 1 {
			s.cache.Load().Store(s.cellarPath(names[i]), fmt.Sprintf("%dM", i+1))
		}
	}
	sizes := s.GetPackageSizes(names, false)
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
}
