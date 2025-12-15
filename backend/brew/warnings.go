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

	// Find the start of JSON (either object or array)
	jsonStart := strings.Index(outputStr, "{")
	if jsonStart == -1 {
		jsonStart = strings.Index(outputStr, "[")
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
		// Check if line contains a formula/cask file path
		// Format: /path/to/Taps/username/homebrew-tap/Formula/package-name.rb:12
		if strings.Contains(line, "/Formula/") || strings.Contains(line, "/Casks/") {
			// Extract package name from file path
			var formulaPath string
			if idx := strings.Index(line, "/Formula/"); idx != -1 {
				formulaPath = line[idx+9:] // Skip "/Formula/"
			} else if idx := strings.Index(line, "/Casks/"); idx != -1 {
				formulaPath = line[idx+7:] // Skip "/Casks/"
			}

			if formulaPath != "" {
				// Extract package name (remove .rb extension and line numbers)
				packageName := formulaPath
				if idx := strings.Index(packageName, ".rb"); idx != -1 {
					packageName = packageName[:idx]
				}
				if idx := strings.Index(packageName, ":"); idx != -1 {
					packageName = packageName[:idx]
				}
				currentPackage = packageName
			}
		}

		// Build up the warning message
		currentWarning.WriteString(line)
		currentWarning.WriteString("\n")
	}

	// Store the warning for the package
	if currentPackage != "" {
		warningMap[currentPackage] = strings.TrimSpace(currentWarning.String())
	}

	return warningMap
}
