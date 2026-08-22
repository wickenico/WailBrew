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

// GetTranslation retrieves a translation value by key, with optional parameter substitution
func (m *Manager) GetTranslation(key string, params map[string]string) string {
	return Get(m.translations, key, params)
}
