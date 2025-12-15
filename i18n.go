package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

//go:embed frontend/src/i18n/locales/*.json
var i18nFS embed.FS

var (
	i18nCache      = make(map[string]map[string]interface{})
	i18nCacheMutex sync.RWMutex
)

// loadTranslations loads translations for the specified language from the embedded JSON files
// Returns a flat map of translation keys to values (e.g., "menu.app.about" -> "About WailBrew")
func loadTranslations(lang string) (map[string]string, error) {
	// Check cache first
	i18nCacheMutex.RLock()
	if translations, exists := i18nCache[lang]; exists {
		i18nCacheMutex.RUnlock()
		return flattenTranslations(translations), nil
	}
	i18nCacheMutex.RUnlock()

	// Load from embedded filesystem
	filePath := fmt.Sprintf("frontend/src/i18n/locales/%s.json", lang)
	data, err := i18nFS.ReadFile(filePath)
	if err != nil {
		// Fallback to English if language file not found
		if lang != "en" {
			return loadTranslations("en")
		}
		return nil, fmt.Errorf("failed to read translation file: %w", err)
	}

	var translations map[string]interface{}
	if err := json.Unmarshal(data, &translations); err != nil {
		return nil, fmt.Errorf("failed to parse translation file: %w", err)
	}

	// Cache the loaded translations
	i18nCacheMutex.Lock()
	i18nCache[lang] = translations
	i18nCacheMutex.Unlock()

	return flattenTranslations(translations), nil
}

// flattenTranslations converts a nested JSON structure into a flat map with dot-notation keys
// Example: {"menu": {"app": {"about": "About"}}} -> {"menu.app.about": "About"}
func flattenTranslations(nested map[string]interface{}) map[string]string {
	result := make(map[string]string)
	flatten("", nested, result)
	return result
}

// flatten recursively flattens nested maps into dot-notation keys
func flatten(prefix string, nested map[string]interface{}, result map[string]string) {
	for key, value := range nested {
		fullKey := key
		if prefix != "" {
			fullKey = prefix + "." + key
		}

		switch v := value.(type) {
		case map[string]interface{}:
			flatten(fullKey, v, result)
		case string:
			result[fullKey] = v
		default:
			// For other types (numbers, booleans, etc.), convert to string
			result[fullKey] = fmt.Sprintf("%v", v)
		}
	}
}

// getTranslation retrieves a translation value by key, with optional parameter substitution
// Parameters should be in the format map[string]string{"name": "value"}
func getTranslation(translations map[string]string, key string, params map[string]string) string {
	value, exists := translations[key]
	if !exists {
		return key // Return key if translation not found
	}

	// Replace parameters in the format {{param}}
	if params != nil {
		for param, paramValue := range params {
			value = strings.ReplaceAll(value, "{{"+param+"}}", paramValue)
		}
	}

	return value
}
