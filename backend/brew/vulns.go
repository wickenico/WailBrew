package brew

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const vulnScanTimeout = 5 * time.Minute

// Vulnerability is one open advisory reported by `brew vulns`.
type Vulnerability struct {
	ID            string   `json:"id"`
	Severity      string   `json:"severity"`
	Summary       string   `json:"summary"`
	Aliases       []string `json:"aliases"`
	FixedVersions []string `json:"fixedVersions"`
	FixAvailable  bool     `json:"fixAvailable"`
}

// FormulaFindings groups the open advisories for one installed formula.
type FormulaFindings struct {
	Formula         string          `json:"formula"`
	Version         string          `json:"version"`
	RepoURL         string          `json:"repoUrl"`
	Vulnerabilities []Vulnerability `json:"vulnerabilities"`
}

// VulnerabilityReport is the result of scanning installed formulae.
// A complete scan still does not guarantee that no vulnerabilities exist.
type VulnerabilityReport struct {
	Findings            []FormulaFindings `json:"findings"`
	SkippedFormulae     []string          `json:"skippedFormulae"`
	Checked             int               `json:"checked"`
	Complete            bool              `json:"complete"`
	OutdatedWithoutSBOM []string          `json:"outdatedWithoutSbom"`
	UnscannedFormulae   map[string]string `json:"unscannedFormulae"`
}

type brewVulnJSON struct {
	ID            string   `json:"id"`
	Severity      string   `json:"severity"`
	Summary       string   `json:"summary"`
	Aliases       []string `json:"aliases"`
	FixedVersions []string `json:"fixed_versions"`
}

type brewFindingJSON struct {
	Formula         string         `json:"formula"`
	Version         string         `json:"version"`
	RepoURL         string         `json:"repo_url"`
	Vulnerabilities []brewVulnJSON `json:"vulnerabilities"`
}

type brewReportJSON struct {
	Findings            []brewFindingJSON `json:"findings"`
	SkippedFormulae     []string          `json:"skipped_formulae"`
	Checked             int               `json:"checked"`
	Complete            bool              `json:"complete"`
	OutdatedWithoutSBOM []string          `json:"outdated_without_sbom"`
	UnscannedFormulae   map[string]string `json:"unscanned_formulae"`
}

// GetBrewVulnerabilities runs `brew vulns --json` against installed formulae.
// Homebrew exits non-zero when it finds advisories, so a parsed report is
// returned even when the command itself fails. A missing command, a timeout,
// or an unreachable OSV.dev response is returned as an error.
func (s *serviceImpl) GetBrewVulnerabilities() (*VulnerabilityReport, error) {
	if s.validateFunc != nil {
		if err := s.validateFunc(); err != nil {
			return nil, fmt.Errorf("homebrew validation failed: %w", err)
		}
	}

	output, err := s.executor.RunNoCacheWithTimeoutStdoutOnly(
		vulnScanTimeout,
		"vulns", "--json", "--max-summary", "0",
	)
	report, parseErr := parseVulnReport(output)
	if parseErr == nil {
		return report, nil
	}
	if err == nil {
		return nil, fmt.Errorf("vulnerability scan failed: %w", parseErr)
	}
	if isVulnsUnavailable(err) {
		return nil, fmt.Errorf("brew vulns is not available in this Homebrew")
	}
	return nil, fmt.Errorf("vulnerability scan failed: %w", err)
}

func parseVulnReport(output []byte) (*VulnerabilityReport, error) {
	jsonOutput, _, err := ExtractJSONFromOutput(string(output))
	if err != nil {
		return nil, err
	}

	var raw brewReportJSON
	if err := json.Unmarshal([]byte(jsonOutput), &raw); err != nil {
		return nil, fmt.Errorf("parse vulnerability report: %w", err)
	}
	return normalizeVulnReport(raw), nil
}

func normalizeVulnReport(raw brewReportJSON) *VulnerabilityReport {
	findings := make([]FormulaFindings, 0, len(raw.Findings))
	for _, finding := range raw.Findings {
		open := make([]Vulnerability, 0, len(finding.Vulnerabilities))
		for _, vuln := range finding.Vulnerabilities {
			if strings.TrimSpace(vuln.ID) == "" {
				continue
			}
			fixed := vuln.FixedVersions
			if fixed == nil {
				fixed = []string{}
			}
			aliases := vuln.Aliases
			if aliases == nil {
				aliases = []string{}
			}
			open = append(open, Vulnerability{
				ID:            vuln.ID,
				Severity:      normalizeSeverity(vuln.Severity),
				Summary:       strings.TrimSpace(vuln.Summary),
				Aliases:       aliases,
				FixedVersions: fixed,
				FixAvailable:  len(fixed) > 0,
			})
		}
		if len(open) == 0 {
			continue
		}
		findings = append(findings, FormulaFindings{
			Formula:         finding.Formula,
			Version:         finding.Version,
			RepoURL:         finding.RepoURL,
			Vulnerabilities: open,
		})
	}

	skipped := raw.SkippedFormulae
	if skipped == nil {
		skipped = []string{}
	}
	outdated := raw.OutdatedWithoutSBOM
	if outdated == nil {
		outdated = []string{}
	}
	unscanned := raw.UnscannedFormulae
	if unscanned == nil {
		unscanned = map[string]string{}
	}

	return &VulnerabilityReport{
		Findings:            findings,
		SkippedFormulae:     skipped,
		Checked:             raw.Checked,
		Complete:            raw.Complete,
		OutdatedWithoutSBOM: outdated,
		UnscannedFormulae:   unscanned,
	}
}

func normalizeSeverity(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "critical", "high", "medium", "low":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "unknown"
	}
}

func isVulnsUnavailable(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "unknown command") || strings.Contains(message, "invalid command")
}
