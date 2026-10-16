package brew

import (
	"encoding/json"
	"strings"
)

type installedCask struct {
	Token       string          `json:"token"`
	FullToken   string          `json:"full_token"`
	Installed   json.RawMessage `json:"installed"`
	Pinned      bool            `json:"pinned"`
	AutoUpdates bool            `json:"auto_updates"`
}

func loadInstalledCasks(executor commandRunner) ([]installedCask, error) {
	output, err := executor.RunStdoutOnly("info", "--cask", "--json=v2", "--installed")
	if err != nil {
		return nil, err
	}
	var result struct {
		Casks []installedCask `json:"casks"`
	}
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, err
	}
	return result.Casks, nil
}

func caskToken(name string) string {
	if i := strings.LastIndexByte(name, '/'); i >= 0 {
		return name[i+1:]
	}
	return name
}
