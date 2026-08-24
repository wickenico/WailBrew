package brew

import (
	"fmt"
	"strings"
)

// ExtractJSONFromOutput extracts the JSON portion from Homebrew command output
// Homebrew may output warnings or error messages before the JSON, which can cause parsing to fail
// This function finds the start of the JSON (either '{' or '[') and returns just the JSON portion
// It also returns any warnings that appeared before the JSON for logging purposes
func ExtractJSONFromOutput(output string) (jsonOutput string, warnings string, err error) {
	outputStr := strings.TrimSpace(output)

	// Find the start of JSON, using whichever of '{' (object) or '[' (array)
	// appears first. Some commands (e.g. `brew tap-info --json=v1`) return a
	// top-level array, so we must not unconditionally prefer '{' or we would
	// strip the leading '[' and produce malformed JSON.
	braceIdx := strings.Index(outputStr, "{")
	bracketIdx := strings.Index(outputStr, "[")
	var jsonStart int
	switch {
	case braceIdx == -1:
		jsonStart = bracketIdx
	case bracketIdx == -1:
		jsonStart = braceIdx
	case braceIdx < bracketIdx:
		jsonStart = braceIdx
	default:
		jsonStart = bracketIdx
	}

	if jsonStart == -1 {
		return "", "", fmt.Errorf("no JSON found in output")
	}

	// Extract warnings if any
	if jsonStart > 0 {
		warnings = strings.TrimSpace(outputStr[:jsonStart])
	}

	// Extract JSON portion
	jsonOutput = outputStr[jsonStart:]

	return jsonOutput, warnings, nil
}

// ParseWarnings parses Homebrew warnings and maps them to specific packages
// Returns a map of package names to their warning messages
func ParseWarnings(warnings string) map[string]string {
	warningMap := make(map[string]string)

	if warnings == "" {
		return warningMap
	}

	// Split warnings into individual warning blocks
	lines := strings.Split(warnings, "\n")
	var currentWarning strings.Builder
	var currentPackage string

	for _, line := range lines {
		// Check if line contains a formula/cask file path.
		// homebrew-core and homebrew-cask (and other large taps) shard their
		// Formula/Casks directory by the package's first character, so the
		// path looks like .../Formula/j/jq.rb:12 rather than .../Formula/jq.rb:12.
		if strings.Contains(line, "/Formula/") || strings.Contains(line, "/Casks/") {
			// Save accumulated warning for the previous package before switching
			if currentPackage != "" {
				warningMap[currentPackage] = strings.TrimSpace(currentWarning.String())
			}

			// Extract package name from file path
			var formulaPath string
			if idx := strings.Index(line, "/Formula/"); idx != -1 {
				formulaPath = line[idx+9:] // Skip "/Formula/"
			} else if idx := strings.Index(line, "/Casks/"); idx != -1 {
				formulaPath = line[idx+7:] // Skip "/Casks/"
			}

			if formulaPath != "" {
				// Extract package name (remove line numbers and .rb extension)
				packageName := formulaPath
				if idx := strings.Index(packageName, ":"); idx != -1 {
					packageName = packageName[:idx]
				}
				packageName = strings.TrimSuffix(packageName, ".rb")
				// Drop any shard subdirectory (e.g. "j/jq" -> "jq") so the
				// name matches the plain package names brew outdated reports.
				if idx := strings.LastIndex(packageName, "/"); idx != -1 {
					packageName = packageName[idx+1:]
				}
				currentPackage = packageName
				currentWarning.Reset()
			}
		}

		// Build up the warning message
		currentWarning.WriteString(line)
		currentWarning.WriteString("\n")
	}

	// Store the warning for the last package
	if currentPackage != "" {
		warningMap[currentPackage] = strings.TrimSpace(currentWarning.String())
	}

	return warningMap
}
