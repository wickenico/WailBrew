package i18n

// Manager handles i18n operations
type Manager struct {
	currentLanguage string
	translations    map[string]string
}

// NewManager creates a new i18n manager
func NewManager(language string) (*Manager, error) {
	translations, err := Load(language)
	if err != nil {
		return nil, err
	}
	return &Manager{
		currentLanguage: language,
		translations:    translations,
	}, nil
}

// Load reloads translations for a new language
func (m *Manager) LoadLanguage(language string) error {
	translations, err := Load(language)
	if err != nil {
		return err
	}
	m.currentLanguage = language
	m.translations = translations
	return nil
}

// GetMenuTranslations returns translations for the current language
func (m *Manager) GetMenuTranslations() map[string]string {
	return m.translations
}

// GetBackendMessage returns a translated backend message using i18n loader
func (m *Manager) GetBackendMessage(key string, params map[string]string) string {
	// Map old keys to new backend.* keys
	keyMap := map[string]string{
		"updateStart":                 "backend.update.start",
		"updateSuccess":               "backend.update.success",
		"updateFailed":                "backend.update.failed",
		"updateAllStart":              "backend.updateAll.start",
		"updateAllSuccess":            "backend.updateAll.success",
		"updateAllFailed":             "backend.updateAll.failed",
		"updateRetryingWithForce":     "backend.update.retryingWithForce",
		"updateRetryingFailedCasks":   "backend.update.retryingFailedCasks",
		"installStart":                "backend.install.start",
		"installSuccess":              "backend.install.success",
		"installFailed":               "backend.install.failed",
		"uninstallStart":              "backend.uninstall.start",
		"uninstallSuccess":            "backend.uninstall.success",
		"uninstallFailed":             "backend.uninstall.failed",
		"errorCreatingPipe":           "backend.errors.creatingPipe",
		"errorCreatingErrorPipe":      "backend.errors.creatingErrorPipe",
		"errorStartingUpdate":         "backend.errors.startingUpdate",
		"errorStartingUpdateAll":      "backend.errors.startingUpdateAll",
		"errorStartingInstall":        "backend.errors.startingInstall",
		"errorStartingUninstall":      "backend.errors.startingUninstall",
		"untapStart":                  "backend.untap.start",
		"untapSuccess":                "backend.untap.success",
		"untapFailed":                 "backend.untap.failed",
		"errorStartingUntap":          "backend.errors.startingUntap",
		"tapStart":                    "backend.tap.start",
		"tapSuccess":                  "backend.tap.success",
		"tapFailed":                   "backend.tap.failed",
		"errorStartingTap":            "backend.errors.startingTap",
		"homebrewUpdateStart":         "backend.homebrewUpdate.start",
		"homebrewUpdateSuccess":       "backend.homebrewUpdate.success",
		"homebrewUpdateFailed":        "backend.homebrewUpdate.failed",
		"homebrewUpdateOutput":        "backend.homebrewUpdate.output",
		"homebrewUpdateWarning":       "backend.homebrewUpdate.warning",
		"errorStartingHomebrewUpdate": "backend.errors.startingHomebrewUpdate",
	}

	// Convert old key to new key format
	newKey, exists := keyMap[key]
	if !exists {
		newKey = "backend." + key // Fallback: try backend.* format
	}

	return Get(m.translations, newKey, params)
}

// GetTranslation retrieves a translation value by key, with optional parameter substitution
func (m *Manager) GetTranslation(key string, params map[string]string) string {
	return Get(m.translations, key, params)
}
