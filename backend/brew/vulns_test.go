package brew

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseVulnReportKeepsOpenAdvisoriesAndDropsPatchedOnlyFormulae(t *testing.T) {
	output := []byte(`Warning: something
{
  "findings": [
    {
      "formula": "curl",
      "version": "8.7.1",
      "repo_url": "https://github.com/curl/curl",
      "vulnerabilities": [
        {
          "id": "CVE-2024-1234",
          "severity": "CRITICAL",
          "summary": "A real bug",
          "aliases": ["GHSA-xxxx"],
          "fixed_versions": ["8.8.0"]
        },
        {
          "id": "GHSA-no-fix",
          "severity": "not-a-level",
          "summary": "  still open  ",
          "fixed_versions": null
        }
      ],
      "patched": [{"id": "CVE-2016-0001", "severity": "LOW"}]
    },
    {
      "formula": "wget",
      "version": "1.21",
      "vulnerabilities": [],
      "patched": [{"id": "CVE-2016-2399", "severity": "LOW"}]
    }
  ],
  "skipped_formulae": ["local-only"],
  "checked": 3,
  "complete": false,
  "outdated_without_sbom": ["openssl@3"],
  "unscanned_formulae": {"git": "no source"}
}`)

	report, err := parseVulnReport(output)
	if err != nil {
		t.Fatalf("parseVulnReport() error = %v", err)
	}
	if len(report.Findings) != 1 {
		t.Fatalf("findings = %d, want 1", len(report.Findings))
	}
	finding := report.Findings[0]
	if finding.Formula != "curl" || finding.Version != "8.7.1" || finding.RepoURL != "https://github.com/curl/curl" {
		t.Fatalf("finding = %+v", finding)
	}
	if len(finding.Vulnerabilities) != 2 {
		t.Fatalf("vulnerabilities = %d, want 2", len(finding.Vulnerabilities))
	}
	critical := finding.Vulnerabilities[0]
	if critical.Severity != "critical" || !critical.FixAvailable || critical.FixedVersions[0] != "8.8.0" || critical.Aliases[0] != "GHSA-xxxx" {
		t.Fatalf("critical advisory = %+v", critical)
	}
	unknown := finding.Vulnerabilities[1]
	if unknown.Severity != "unknown" || unknown.FixAvailable || unknown.Summary != "still open" || unknown.FixedVersions == nil || unknown.Aliases == nil {
		t.Fatalf("unknown advisory = %+v", unknown)
	}
	if report.Checked != 3 || report.Complete || report.SkippedFormulae[0] != "local-only" || report.OutdatedWithoutSBOM[0] != "openssl@3" || report.UnscannedFormulae["git"] != "no source" {
		t.Fatalf("coverage = %+v", report)
	}
}

func TestParseVulnReportEmptyScan(t *testing.T) {
	report, err := parseVulnReport([]byte(`{
  "findings": [],
  "skipped_formulae": [],
  "checked": 2,
  "complete": true,
  "outdated_without_sbom": [],
  "unscanned_formulae": {}
}`))
	if err != nil {
		t.Fatalf("parseVulnReport() error = %v", err)
	}
	if report.Findings == nil || report.SkippedFormulae == nil || report.OutdatedWithoutSBOM == nil || report.UnscannedFormulae == nil {
		t.Fatalf("expected empty collections, got %+v", report)
	}
	if !report.Complete || report.Checked != 2 || len(report.Findings) != 0 {
		t.Fatalf("report = %+v", report)
	}
}

func TestGetBrewVulnerabilitiesAcceptsNonZeroExitWhenJSONIsPresent(t *testing.T) {
	dir := t.TempDir()
	brewPath := filepath.Join(dir, "brew")
	script := `#!/bin/sh
echo "openssl@3 could not be determined" >&2
cat <<'EOF'
{
  "findings": [
    {
      "formula": "curl",
      "version": "8.7.1",
      "vulnerabilities": [
        {"id": "CVE-2024-1234", "severity": "HIGH", "summary": "bug", "fixed_versions": []}
      ]
    }
  ],
  "skipped_formulae": [],
  "checked": 1,
  "complete": false,
  "outdated_without_sbom": ["openssl@3"],
  "unscanned_formulae": {}
}
EOF
exit 1
`
	if err := os.WriteFile(brewPath, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	service := &serviceImpl{
		executor:     NewExecutor(brewPath, nil, nil),
		validateFunc: func() error { return nil },
	}

	report, err := service.GetBrewVulnerabilities()
	if err != nil {
		t.Fatalf("GetBrewVulnerabilities() error = %v", err)
	}
	if len(report.Findings) != 1 || report.Findings[0].Vulnerabilities[0].Severity != "high" || report.Findings[0].Vulnerabilities[0].FixAvailable {
		t.Fatalf("report = %+v", report)
	}
}

func TestGetBrewVulnerabilitiesReportsMissingCommand(t *testing.T) {
	dir := t.TempDir()
	brewPath := filepath.Join(dir, "brew")
	script := `#!/bin/sh
echo "Error: Unknown command: vulns" >&2
exit 1
`
	if err := os.WriteFile(brewPath, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	service := &serviceImpl{
		executor:     NewExecutor(brewPath, nil, nil),
		validateFunc: func() error { return nil },
	}

	_, err := service.GetBrewVulnerabilities()
	if err == nil || !strings.Contains(err.Error(), "not available") {
		t.Fatalf("error = %v, want unavailable", err)
	}
}
