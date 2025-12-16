package i18n

import (
	"embed"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

// FS is the embedded filesystem for translation files
// This must be set by the main package before using Load
var FS embed.FS

var (
	cache      = make(map[string]map[string]interface{})
	cacheMutex sync.RWMutex
)

// Load loads translations for the specified language from the embedded JSON files
func Load(lang string) (map[string]string, error) {
	// Check cache first
	cacheMutex.RLock()
	if translations, exists := cache[lang]; exists {
		cacheMutex.RUnlock()
		return flattenTranslations(translations), nil
	}
	cacheMutex.RUnlock()

	// Load from embedded filesystem
	filePath := fmt.Sprintf("frontend/src/i18n/locales/%s.json", lang)
	data, err := FS.ReadFile(filePath)
	if err != nil {
		// Fallback to English if language file not found
		if lang != "en" {
			return Load("en")
		}
		return nil, fmt.Errorf("failed to read translation file: %w", err)
	}

	var translations map[string]interface{}
	if err := json.Unmarshal(data, &translations); err != nil {
		return nil, fmt.Errorf("failed to parse translation file: %w", err)
	}

	// Cache the loaded translations
	cacheMutex.Lock()
	cache[lang] = translations
	cacheMutex.Unlock()

	return flattenTranslations(translations), nil
}

// flattenTranslations converts a nested JSON structure into a flat map with dot-notation keys
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
			result[fullKey] = fmt.Sprintf("%v", v)
		}
	}
}

// Get retrieves a translation value by key, with optional parameter substitution
func Get(translations map[string]string, key string, params map[string]string) string {
	value, exists := translations[key]
	if !exists {
		return key
	}

	if params != nil {
		for param, paramValue := range params {
			value = strings.ReplaceAll(value, "{{"+param+"}}", paramValue)
		}
	}

	return value
}
