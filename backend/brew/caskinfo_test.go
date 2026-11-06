package brew

import "testing"

func TestParseWailbrewCaskInfo(t *testing.T) {
	tests := []struct {
		name          string
		json          string
		wantVersion   string
		wantInstalled bool
		wantErr       bool
	}{
		{
			name:          "installed via Homebrew",
			json:          `{"formulae":[],"casks":[{"token":"wailbrew","version":"0.15.0","installed":"0.14.0"}]}`,
			wantVersion:   "0.15.0",
			wantInstalled: true,
		},
		{
			name:        "not installed (e.g. DMG install)",
			json:        `{"formulae":[],"casks":[{"token":"wailbrew","version":"0.15.0","installed":null}]}`,
			wantVersion: "0.15.0",
		},
		{
			name:        "installed field missing",
			json:        `{"casks":[{"token":"wailbrew","version":"0.15.0"}]}`,
			wantVersion: "0.15.0",
		},
		{name: "no casks", json: `{"casks":[]}`, wantErr: true},
		{name: "empty version", json: `{"casks":[{"token":"wailbrew","version":""}]}`, wantErr: true},
		{name: "invalid JSON", json: `not json`, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseWailbrewCaskInfo([]byte(tt.json))
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got %+v", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.Version != tt.wantVersion || got.Installed != tt.wantInstalled {
				t.Errorf("got %+v, want version %q installed %v", got, tt.wantVersion, tt.wantInstalled)
			}
		})
	}
}
