package brew

import (
	"reflect"
	"testing"
)

func TestGetBrewUpdatablePackages_casks(t *testing.T) {
	runner := &fakeRunner{stdout: map[string]string{
		"outdated --json=v2 --greedy-auto-updates": `{"formulae":[],"casks":[{"name":"orca","installed_versions":["1.4.224"],"current_version":"1.4.226"},{"name":"firefox","installed_versions":["120.0"],"current_version":"121.0"}]}`,
		"info --cask --json=v2 --installed":        `{"casks":[{"token":"orca","full_token":"stablyai/orca/orca","auto_updates":true},{"token":"firefox","full_token":"firefox","auto_updates":false}]}`,
	}}
	service := NewOutdatedService(
		runner, func() error { return nil }, nil,
		ExtractJSONFromOutput, func(string) map[string]string { return nil },
		func(_ []string, isCask bool) map[string]string {
			if !isCask {
				return nil
			}
			return map[string]string{"orca": "794M", "firefox": "300M"}
		},
		func() string { return OutdatedFlagGreedyAutoUpdate },
		func() string { return "" },
		func(string, map[string]string) string { return "auto updates" },
	)
	want := [][]string{
		{"orca", "1.4.224", "1.4.226", "794M", "auto updates", "cask", "stablyai/orca/orca"},
		{"firefox", "120.0", "121.0", "300M", "", "cask", "firefox"},
	}
	if got := service.GetBrewUpdatablePackages(); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestGetBrewUpdatablePackages_missingCask(t *testing.T) {
	runner := &fakeRunner{stdout: map[string]string{
		"outdated --json=v2":                `{"casks":[{"name":"firefox","installed_versions":["120.0"],"current_version":"121.0"}]}`,
		"info --cask --json=v2 --installed": `{"casks":[]}`,
	}}
	service := NewOutdatedService(
		runner, func() error { return nil }, nil,
		ExtractJSONFromOutput, func(string) map[string]string { return nil }, nil,
		func() string { return OutdatedFlagNone }, func() string { return "" }, nil,
	)
	rows := service.GetBrewUpdatablePackages()
	if len(rows) != 1 || rows[0][0] != "Error" {
		t.Fatalf("expected Error, got %v", rows)
	}
}
