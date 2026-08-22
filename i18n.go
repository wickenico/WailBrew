package main

import (
	"embed"
)

//go:embed frontend/src/i18n/locales/*.json
var i18nFS embed.FS
