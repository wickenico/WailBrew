package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	rt "github.com/wailsapp/wails/v2/pkg/runtime"
)

var Version = "0.dev"

// Standard PATH and locale for brew commands
const brewEnvPath = "PATH=/opt/homebrew/sbin:/opt/homebrew/bin:/usr/local/sbin:/usr/local/bin:/usr/bin:/bin"
const brewEnvLang = "LANG=en_US.UTF-8"
const brewEnvLCAll = "LC_ALL=en_US.UTF-8"
const brewEnvNoAutoUpdate = "HOMEBREW_NO_AUTO_UPDATE=1"

// Askpass helper script content for GUI sudo password prompts
const askpassScript = `#!/bin/bash
# Askpass helper for GUI sudo password prompts
# This script must output the password to stdout and exit with 0 on success, or exit with 1 on failure
password=$(osascript <<'EOF'
try
    display dialog "WailBrew requires administrator privileges to upgrade certain packages. Please enter your password:" default answer "" with icon caution with title "Administrator Password Required" with hidden answer
    set result to text returned of result
    return result
on error
    -- User cancelled or error occurred
    return ""
end try
EOF
)
if [ -z "$password" ]; then
    exit 1
fi
echo -n "$password"
`

// MenuTranslations holds all menu translations
type MenuTranslations struct {
	App struct {
		About          string `json:"about"`
		CheckUpdates   string `json:"checkUpdates"`
		VisitWebsite   string `json:"visitWebsite"`
		VisitGitHub    string `json:"visitGitHub"`
		ReportBug      string `json:"reportBug"`
		VisitSubreddit string `json:"visitSubreddit"`
		SponsorProject string `json:"sponsorProject"`
		Quit           string `json:"quit"`
	} `json:"app"`
	View struct {
		Title        string `json:"title"`
		Installed    string `json:"installed"`
		Casks        string `json:"casks"`
		Outdated     string `json:"outdated"`
		All          string `json:"all"`
		Leaves       string `json:"leaves"`
		Repositories string `json:"repositories"`
		Homebrew     string `json:"homebrew"`
		Doctor       string `json:"doctor"`
		Cleanup      string `json:"cleanup"`
		Settings     string `json:"settings"`
	} `json:"view"`
	Tools struct {
		Title           string `json:"title"`
		ExportBrewfile  string `json:"exportBrewfile"`
		ExportSuccess   string `json:"exportSuccess"`
		ExportFailed    string `json:"exportFailed"`
		ExportMessage   string `json:"exportMessage"`
		ViewSessionLogs string `json:"viewSessionLogs"`
	} `json:"tools"`
	Help struct {
		Title        string `json:"title"`
		WailbrewHelp string `json:"wailbrewHelp"`
		HelpTitle    string `json:"helpTitle"`
		HelpMessage  string `json:"helpMessage"`
	} `json:"help"`
}

// getMenuTranslations returns translations for the current language
func (a *App) getMenuTranslations() MenuTranslations {
	var translations MenuTranslations

	switch a.currentLanguage {
	case "en":
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				ReportBug      string `json:"reportBug"`
				VisitSubreddit string `json:"visitSubreddit"`
				SponsorProject string `json:"sponsorProject"`
				Quit           string `json:"quit"`
			}{
				About:          "About WailBrew",
				CheckUpdates:   "Check for Updates...",
				VisitWebsite:   "Visit Website",
				VisitGitHub:    "Visit GitHub Repo",
				ReportBug:      "Report Bug",
				VisitSubreddit: "Visit Subreddit",
				SponsorProject: "Sponsor Project",
				Quit:           "Quit",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Homebrew     string `json:"homebrew"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "View",
				Installed:    "Installed Formulae",
				Casks:        "Casks",
				Outdated:     "Outdated Formulae",
				All:          "All Formulae",
				Leaves:       "Leaves",
				Repositories: "Repositories",
				Homebrew:     "Homebrew",
				Doctor:       "Doctor",
				Cleanup:      "Cleanup",
				Settings:     "Settings",
			},
			Tools: struct {
				Title           string `json:"title"`
				ExportBrewfile  string `json:"exportBrewfile"`
				ExportSuccess   string `json:"exportSuccess"`
				ExportFailed    string `json:"exportFailed"`
				ExportMessage   string `json:"exportMessage"`
				ViewSessionLogs string `json:"viewSessionLogs"`
			}{
				Title:           "Tools",
				ExportBrewfile:  "Export Brewfile...",
				ExportSuccess:   "Export Successful",
				ExportFailed:    "Export Failed",
				ExportMessage:   "Brewfile exported successfully to:\n%s",
				ViewSessionLogs: "View Session Logs...",
			},
			Help: struct {
				Title        string `json:"title"`
				WailbrewHelp string `json:"wailbrewHelp"`
				HelpTitle    string `json:"helpTitle"`
				HelpMessage  string `json:"helpMessage"`
			}{
				Title:        "Help",
				WailbrewHelp: "WailBrew Help",
				HelpTitle:    "Help",
				HelpMessage:  "Currently there is no help page available.",
			},
		}
	case "de":
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				ReportBug      string `json:"reportBug"`
				VisitSubreddit string `json:"visitSubreddit"`
				SponsorProject string `json:"sponsorProject"`
				Quit           string `json:"quit"`
			}{
				About:          "Über WailBrew",
				CheckUpdates:   "Auf Aktualisierungen prüfen...",
				VisitWebsite:   "Website besuchen",
				VisitGitHub:    "GitHub Repo besuchen",
				ReportBug:      "Fehler melden",
				VisitSubreddit: "Subreddit besuchen",
				SponsorProject: "Projekt unterstützen",
				Quit:           "Beenden",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Homebrew     string `json:"homebrew"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "Ansicht",
				Installed:    "Installierte Formeln",
				Casks:        "Casks",
				Outdated:     "Veraltete Formeln",
				All:          "Alle Formeln",
				Leaves:       "Blätter",
				Repositories: "Repositories",
				Homebrew:     "Homebrew",
				Doctor:       "Doctor",
				Cleanup:      "Cleanup",
				Settings:     "Einstellungen",
			},
			Tools: struct {
				Title           string `json:"title"`
				ExportBrewfile  string `json:"exportBrewfile"`
				ExportSuccess   string `json:"exportSuccess"`
				ExportFailed    string `json:"exportFailed"`
				ExportMessage   string `json:"exportMessage"`
				ViewSessionLogs string `json:"viewSessionLogs"`
			}{
				Title:           "Werkzeuge",
				ExportBrewfile:  "Brewfile exportieren...",
				ExportSuccess:   "Export Erfolgreich",
				ExportFailed:    "Export Fehlgeschlagen",
				ExportMessage:   "Brewfile erfolgreich exportiert nach:\n%s",
				ViewSessionLogs: "Sitzungsprotokolle anzeigen...",
			},
			Help: struct {
				Title        string `json:"title"`
				WailbrewHelp string `json:"wailbrewHelp"`
				HelpTitle    string `json:"helpTitle"`
				HelpMessage  string `json:"helpMessage"`
			}{
				Title:        "Hilfe",
				WailbrewHelp: "WailBrew-Hilfe",
				HelpTitle:    "Hilfe",
				HelpMessage:  "Aktuell gibt es noch keine Hilfeseite.",
			},
		}
	case "fr":
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				ReportBug      string `json:"reportBug"`
				VisitSubreddit string `json:"visitSubreddit"`
				SponsorProject string `json:"sponsorProject"`
				Quit           string `json:"quit"`
			}{
				About:          "À propos de WailBrew",
				CheckUpdates:   "Vérifier les mises à jour...",
				VisitWebsite:   "Visiter le site Web",
				VisitGitHub:    "Visiter le dépôt GitHub",
				ReportBug:      "Signaler un bug",
				VisitSubreddit: "Visiter le Subreddit",
				SponsorProject: "Soutenir le projet",
				Quit:           "Quitter",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Homebrew     string `json:"homebrew"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "Affichage",
				Installed:    "Formules Installées",
				Casks:        "Casks",
				Outdated:     "Formules Obsolètes",
				All:          "Toutes les Formules",
				Leaves:       "Feuilles",
				Repositories: "Dépôts",
				Homebrew:     "Homebrew",
				Doctor:       "Diagnostic",
				Cleanup:      "Nettoyage",
				Settings:     "Paramètres",
			},
			Tools: struct {
				Title           string `json:"title"`
				ExportBrewfile  string `json:"exportBrewfile"`
				ExportSuccess   string `json:"exportSuccess"`
				ExportFailed    string `json:"exportFailed"`
				ExportMessage   string `json:"exportMessage"`
				ViewSessionLogs string `json:"viewSessionLogs"`
			}{
				Title:           "Outils",
				ExportBrewfile:  "Exporter Brewfile...",
				ExportSuccess:   "Export Réussi",
				ExportFailed:    "Échec de l'Export",
				ExportMessage:   "Brewfile exporté avec succès vers :\n%s",
				ViewSessionLogs: "Afficher les journaux de session...",
			},
			Help: struct {
				Title        string `json:"title"`
				WailbrewHelp string `json:"wailbrewHelp"`
				HelpTitle    string `json:"helpTitle"`
				HelpMessage  string `json:"helpMessage"`
			}{
				Title:        "Aide",
				WailbrewHelp: "Aide WailBrew",
				HelpTitle:    "Aide",
				HelpMessage:  "Aucune page d'aide n'est actuellement disponible.",
			},
		}
	case "tr":
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				ReportBug      string `json:"reportBug"`
				VisitSubreddit string `json:"visitSubreddit"`
				SponsorProject string `json:"sponsorProject"`
				Quit           string `json:"quit"`
			}{
				About:          "WailBrew Hakkında",
				CheckUpdates:   "Güncellemeleri Kontrol Et...",
				VisitWebsite:   "Siteyi Görüntüle",
				VisitGitHub:    "GitHub Deposunu Ziyaret Et",
				ReportBug:      "Hata Bildir",
				VisitSubreddit: "Subreddit'i Ziyaret Et",
				SponsorProject: "Projeyi Destekle",
				Quit:           "Çık",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Homebrew     string `json:"homebrew"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "Görünüm",
				Installed:    "Yüklenen Formüller",
				Casks:        "Fıçılar",
				Outdated:     "Eskimiş Formüller",
				All:          "Tüm Formüller",
				Leaves:       "Yapraklar",
				Repositories: "Depolar",
				Homebrew:     "Homebrew",
				Doctor:       "Doktor",
				Cleanup:      "Temizlik",
				Settings:     "Ayarlar",
			},
			Tools: struct {
				Title           string `json:"title"`
				ExportBrewfile  string `json:"exportBrewfile"`
				ExportSuccess   string `json:"exportSuccess"`
				ExportFailed    string `json:"exportFailed"`
				ExportMessage   string `json:"exportMessage"`
				ViewSessionLogs string `json:"viewSessionLogs"`
			}{
				Title:           "Araçlar",
				ExportBrewfile:  "Brewfile Dışa Aktar...",
				ExportSuccess:   "Dışa Aktarma Başarılı",
				ExportFailed:    "Dışa Aktarma Başarısız",
				ExportMessage:   "Brewfile başarıyla şuraya aktarıldı:\n%s",
				ViewSessionLogs: "Oturum Günlüklerini Görüntüle...",
			},
			Help: struct {
				Title        string `json:"title"`
				WailbrewHelp string `json:"wailbrewHelp"`
				HelpTitle    string `json:"helpTitle"`
				HelpMessage  string `json:"helpMessage"`
			}{
				Title:        "Yardım",
				WailbrewHelp: "WailBrew Yardım",
				HelpTitle:    "Yardım",
				HelpMessage:  "Şu an bir yardım sayfası bulunmuyor.",
			},
		}
	case "zhCN":
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				ReportBug      string `json:"reportBug"`
				VisitSubreddit string `json:"visitSubreddit"`
				SponsorProject string `json:"sponsorProject"`
				Quit           string `json:"quit"`
			}{
				About:          "关于 WailBrew",
				CheckUpdates:   "检查更新...",
				VisitWebsite:   "访问主页",
				VisitGitHub:    "访问 GitHub 仓库",
				ReportBug:      "报告 Bug",
				VisitSubreddit: "访问 Subreddit",
				SponsorProject: "赞助项目",
				Quit:           "退出",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Homebrew     string `json:"homebrew"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "显示",
				Installed:    "已安装的 Formulae",
				Casks:        "Casks",
				Outdated:     "可更新的 Formulae",
				All:          "所有 Formulae",
				Leaves:       "独立包",
				Repositories: "软件源",
				Homebrew:     "Homebrew",
				Doctor:       "Doctor",
				Cleanup:      "Cleanup",
				Settings:     "软件设置",
			},
			Tools: struct {
				Title           string `json:"title"`
				ExportBrewfile  string `json:"exportBrewfile"`
				ExportSuccess   string `json:"exportSuccess"`
				ExportFailed    string `json:"exportFailed"`
				ExportMessage   string `json:"exportMessage"`
				ViewSessionLogs string `json:"viewSessionLogs"`
			}{
				Title:           "工具",
				ExportBrewfile:  "导出 Brewfile...",
				ExportSuccess:   "导出成功",
				ExportFailed:    "导出失败",
				ExportMessage:   "Brewfile 已成功导出到:\n%s",
				ViewSessionLogs: "查看会话日志...",
			},
			Help: struct {
				Title        string `json:"title"`
				WailbrewHelp string `json:"wailbrewHelp"`
				HelpTitle    string `json:"helpTitle"`
				HelpMessage  string `json:"helpMessage"`
			}{
				Title:        "帮助",
				WailbrewHelp: "WailBrew 帮助",
				HelpTitle:    "帮助",
				HelpMessage:  "当前没有可用的帮助页面。",
			},
		}
	case "pt_BR":
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				ReportBug      string `json:"reportBug"`
				VisitSubreddit string `json:"visitSubreddit"`
				SponsorProject string `json:"sponsorProject"`
				Quit           string `json:"quit"`
			}{
				About:          "Sobre o WailBrew",
				CheckUpdates:   "Verificar Atualizações...",
				VisitWebsite:   "Visitar Site",
				VisitGitHub:    "Visitar Repositório no GitHub",
				ReportBug:      "Reportar um Bug",
				VisitSubreddit: "Visitar Subreddit",
				SponsorProject: "Apoiar o Projeto",
				Quit:           "Sair",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Homebrew     string `json:"homebrew"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "Visualizar",
				Installed:    "Fórmulas Instaladas",
				Casks:        "Casks",
				Outdated:     "Fórmulas Desatualizadas",
				All:          "Todas as Fórmulas",
				Leaves:       "Leaves",
				Repositories: "Repositórios",
				Homebrew:     "Homebrew",
				Doctor:       "Diagnóstico",
				Cleanup:      "Limpeza",
				Settings:     "Configurações",
			},
			Tools: struct {
				Title           string `json:"title"`
				ExportBrewfile  string `json:"exportBrewfile"`
				ExportSuccess   string `json:"exportSuccess"`
				ExportFailed    string `json:"exportFailed"`
				ExportMessage   string `json:"exportMessage"`
				ViewSessionLogs string `json:"viewSessionLogs"`
			}{
				Title:           "Ferramentas",
				ExportBrewfile:  "Exportar Brewfile...",
				ExportSuccess:   "Exportado com Sucesso",
				ExportFailed:    "Falha na Exportação",
				ExportMessage:   "Brewfile exportado com sucesso para:\n%s",
				ViewSessionLogs: "Ver Registros de Sessão...",
			},
			Help: struct {
				Title        string `json:"title"`
				WailbrewHelp string `json:"wailbrewHelp"`
				HelpTitle    string `json:"helpTitle"`
				HelpMessage  string `json:"helpMessage"`
			}{
				Title:        "Ajuda",
				WailbrewHelp: "Ajuda do WailBrew",
				HelpTitle:    "Ajuda",
				HelpMessage:  "Atualmente não há nenhuma página de ajuda disponível.",
			},
		}
	case "ru":
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				ReportBug      string `json:"reportBug"`
				VisitSubreddit string `json:"visitSubreddit"`
				SponsorProject string `json:"sponsorProject"`
				Quit           string `json:"quit"`
			}{
				About:          "О WailBrew",
				CheckUpdates:   "Проверить обновления...",
				VisitWebsite:   "Посетить сайт",
				VisitGitHub:    "Посетить репозиторий на GitHub",
				ReportBug:      "Сообщить об ошибке",
				VisitSubreddit: "Посетить Subreddit",
				SponsorProject: "Поддержать проект",
				Quit:           "Выход",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Homebrew     string `json:"homebrew"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "Вид",
				Installed:    "Установленные пакеты",
				Casks:        "Приложения",
				Outdated:     "Устаревшие пакеты",
				All:          "Все пакеты",
				Leaves:       "Листья",
				Repositories: "Репозитории",
				Homebrew:     "Homebrew",
				Doctor:       "Диагностика",
				Cleanup:      "Очистка",
				Settings:     "Настройки",
			},
			Tools: struct {
				Title           string `json:"title"`
				ExportBrewfile  string `json:"exportBrewfile"`
				ExportSuccess   string `json:"exportSuccess"`
				ExportFailed    string `json:"exportFailed"`
				ExportMessage   string `json:"exportMessage"`
				ViewSessionLogs string `json:"viewSessionLogs"`
			}{
				Title:           "Инструменты",
				ExportBrewfile:  "Экспортировать Brewfile...",
				ExportSuccess:   "Успешно экспортировано",
				ExportFailed:    "Не удалось экспортировать",
				ExportMessage:   "Brewfile успешно экспортирован в:\n%s",
				ViewSessionLogs: "Просмотр журналов сеанса...",
			},
			Help: struct {
				Title        string `json:"title"`
				WailbrewHelp string `json:"wailbrewHelp"`
				HelpTitle    string `json:"helpTitle"`
				HelpMessage  string `json:"helpMessage"`
			}{
				Title:        "Справка",
				WailbrewHelp: "Справка WailBrew",
				HelpTitle:    "Справка",
				HelpMessage:  "В настоящее время страница справки недоступна.",
			},
		}
	default:
		// Default to English
		translations = MenuTranslations{
			App: struct {
				About          string `json:"about"`
				CheckUpdates   string `json:"checkUpdates"`
				VisitWebsite   string `json:"visitWebsite"`
				VisitGitHub    string `json:"visitGitHub"`
				ReportBug      string `json:"reportBug"`
				VisitSubreddit string `json:"visitSubreddit"`
				SponsorProject string `json:"sponsorProject"`
				Quit           string `json:"quit"`
			}{
				About:          "About WailBrew",
				CheckUpdates:   "Check for Updates...",
				VisitWebsite:   "Visit Website",
				VisitGitHub:    "Visit GitHub Repo",
				ReportBug:      "Report Bug",
				VisitSubreddit: "Visit Subreddit",
				SponsorProject: "Sponsor Project",
				Quit:           "Quit",
			},
			View: struct {
				Title        string `json:"title"`
				Installed    string `json:"installed"`
				Casks        string `json:"casks"`
				Outdated     string `json:"outdated"`
				All          string `json:"all"`
				Leaves       string `json:"leaves"`
				Repositories string `json:"repositories"`
				Homebrew     string `json:"homebrew"`
				Doctor       string `json:"doctor"`
				Cleanup      string `json:"cleanup"`
				Settings     string `json:"settings"`
			}{
				Title:        "View",
				Installed:    "Installed Formulae",
				Casks:        "Casks",
				Outdated:     "Outdated Formulae",
				All:          "All Formulae",
				Leaves:       "Leaves",
				Repositories: "Repositories",
				Homebrew:     "Homebrew",
				Doctor:       "Doctor",
				Cleanup:      "Cleanup",
				Settings:     "Settings",
			},
			Tools: struct {
				Title           string `json:"title"`
				ExportBrewfile  string `json:"exportBrewfile"`
				ExportSuccess   string `json:"exportSuccess"`
				ExportFailed    string `json:"exportFailed"`
				ExportMessage   string `json:"exportMessage"`
				ViewSessionLogs string `json:"viewSessionLogs"`
			}{
				Title:           "Tools",
				ExportBrewfile:  "Export Brewfile...",
				ExportSuccess:   "Export Successful",
				ExportFailed:    "Export Failed",
				ExportMessage:   "Brewfile exported successfully to:\n%s",
				ViewSessionLogs: "View Session Logs...",
			},
			Help: struct {
				Title        string `json:"title"`
				WailbrewHelp string `json:"wailbrewHelp"`
				HelpTitle    string `json:"helpTitle"`
				HelpMessage  string `json:"helpMessage"`
			}{
				Title:        "Help",
				WailbrewHelp: "WailBrew Help",
				HelpTitle:    "Help",
				HelpMessage:  "Currently there is no help page available.",
			},
		}
	}

	return translations
}

// GitHubRelease represents a GitHub release
type GitHubRelease struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	Body        string `json:"body"`
	PublishedAt string `json:"published_at"`
	Assets      []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
		Size               int64  `json:"size"`
	} `json:"assets"`
}

// UpdateInfo contains information about available updates
type UpdateInfo struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	ReleaseNotes   string `json:"releaseNotes"`
	DownloadURL    string `json:"downloadUrl"`
	FileSize       int64  `json:"fileSize"`
	PublishedAt    string `json:"publishedAt"`
}

// NewPackagesInfo contains information about newly discovered packages
type NewPackagesInfo struct {
	NewFormulae []string `json:"newFormulae"`
	NewCasks    []string `json:"newCasks"`
}

// App struct
type App struct {
	ctx                context.Context
	brewPath           string
	askpassPath        string
	currentLanguage    string
	updateMutex        sync.Mutex
	lastUpdateTime     time.Time
	knownPackages      map[string]bool // Track all known packages to detect new ones
	knownPackagesMutex sync.Mutex
	sessionLogs        []string   // Session logs for debugging
	sessionLogsMutex   sync.Mutex // Mutex for thread-safe log access
	gitRemote          string     // HOMEBREW_GIT_REMOTE mirror source
	bottleDomain       string     // HOMEBREW_BOTTLE_DOMAIN mirror source
}

// detectBrewPath automatically detects the brew binary path
func detectBrewPath() string {
	// Common brew paths for different Mac architectures
	paths := []string{
		"/opt/homebrew/bin/brew",              // M1 Macs (Apple Silicon)
		"/usr/local/bin/brew",                 // Intel Macs
		"/home/linuxbrew/.linuxbrew/bin/brew", // Linux (if supported)
	}

	for _, path := range paths {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	// Fallback: try to find brew in PATH
	if path, err := exec.LookPath("brew"); err == nil {
		return path
	}

	// Last resort: default to M1 path
	return "/opt/homebrew/bin/brew"
}

// NewApp creates a new App application struct
func NewApp() *App {
	brewPath := detectBrewPath()
	return &App{
		brewPath:        brewPath,
		currentLanguage: "en",
		knownPackages:   make(map[string]bool),
		sessionLogs:     make([]string, 0),
	}
}

// setupAskpassHelper creates the askpass helper script for GUI sudo prompts
func (a *App) setupAskpassHelper() error {
	// Create a temporary directory for the askpass helper
	tempDir := os.TempDir()
	askpassPath := fmt.Sprintf("%s/wailbrew-askpass-%d.sh", tempDir, os.Getpid())

	// Write the askpass script to the temp file
	if err := os.WriteFile(askpassPath, []byte(askpassScript), 0700); err != nil {
		return fmt.Errorf("failed to create askpass helper: %w", err)
	}

	a.askpassPath = askpassPath
	return nil
}

// cleanupAskpassHelper removes the askpass helper script
func (a *App) cleanupAskpassHelper() {
	if a.askpassPath != "" {
		os.Remove(a.askpassPath)
	}
}

// getBrewEnv returns the standard brew environment variables including SUDO_ASKPASS
// SUDO_ASKPASS allows sudo to use our GUI password prompt instead of requiring terminal input
// When set, sudo will automatically call the askpass script when it needs a password
func (a *App) getBrewEnv() []string {
	env := []string{
		brewEnvPath,
		brewEnvLang,
		brewEnvLCAll,
		brewEnvNoAutoUpdate,
	}

	// Add SUDO_ASKPASS if askpass helper is available
	// This enables GUI password prompts for sudo operations during brew upgrades
	if a.askpassPath != "" {
		env = append(env, fmt.Sprintf("SUDO_ASKPASS=%s", a.askpassPath))
	}

	// Add mirror source environment variables if configured
	if a.gitRemote != "" {
		env = append(env, fmt.Sprintf("HOMEBREW_GIT_REMOTE=%s", a.gitRemote))
	}
	if a.bottleDomain != "" {
		env = append(env, fmt.Sprintf("HOMEBREW_BOTTLE_DOMAIN=%s", a.bottleDomain))
	}

	return env
}

// runBrewCommand executes a brew command and returns output and error
func (a *App) runBrewCommand(args ...string) ([]byte, error) {
	return a.runBrewCommandWithTimeout(30*time.Second, args...)
}

// runBrewCommandWithTimeout executes a brew command with a timeout
func (a *App) runBrewCommandWithTimeout(timeout time.Duration, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmdStr := fmt.Sprintf("brew %s", strings.Join(args, " "))
	// Log command start asynchronously to avoid blocking
	go a.appendSessionLog(fmt.Sprintf("Executing: %s", cmdStr))

	cmd := exec.CommandContext(ctx, a.brewPath, args...)
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	output, err := cmd.CombinedOutput()

	// Check if the error was due to timeout
	if ctx.Err() == context.DeadlineExceeded {
		errorMsg := fmt.Sprintf("Command timed out after %v: brew %v", timeout, args)
		go a.appendSessionLog(fmt.Sprintf("ERROR: %s", errorMsg))
		return nil, fmt.Errorf(errorMsg)
	}

	// Log result asynchronously (non-blocking, won't affect command execution)
	if err != nil {
		outputStr := string(output)
		if len(outputStr) > 500 {
			outputStr = outputStr[:500] + "... (truncated)"
		}
		go a.appendSessionLog(fmt.Sprintf("ERROR: %s failed: %v\nOutput: %s", cmdStr, err, outputStr))
	} else {
		go a.appendSessionLog(fmt.Sprintf("SUCCESS: %s completed", cmdStr))
	}

	return output, err
}

// validateBrewInstallation checks if brew is working properly
func (a *App) validateBrewInstallation() error {
	// First check if brew executable exists
	if _, err := os.Stat(a.brewPath); os.IsNotExist(err) {
		return fmt.Errorf("brew not found at path: %s", a.brewPath)
	}

	// Try running a simple brew command to verify it works
	_, err := a.runBrewCommand("--version")
	if err != nil {
		return fmt.Errorf("brew is not working properly: %v", err)
	}

	return nil
}

// startup saves the application context and sets up the askpass helper
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Set up the askpass helper for GUI sudo prompts
	if err := a.setupAskpassHelper(); err != nil {
		// Log error but don't fail startup - the app can still work without askpass
		fmt.Fprintf(os.Stderr, "Warning: failed to setup askpass helper: %v\n", err)
	}
}

// shutdown cleans up resources when the application exits
func (a *App) shutdown(ctx context.Context) {
	a.cleanupAskpassHelper()
	a.clearSessionLogs()
}

func (a *App) OpenURL(url string) {
	rt.BrowserOpenURL(a.ctx, url)
}

// SetLanguage updates the current language and rebuilds the menu
func (a *App) SetLanguage(language string) {
	a.currentLanguage = language
	// Rebuild the menu with new language
	newMenu := a.menu()
	rt.MenuSetApplicationMenu(a.ctx, newMenu)
}

// GetCurrentLanguage returns the current language
func (a *App) GetCurrentLanguage() string {
	return a.currentLanguage
}

// appendSessionLog adds a log entry to the session log buffer
// This function is safe to call from any goroutine and will not panic
func (a *App) appendSessionLog(entry string) {
	defer func() {
		// Recover from any panic to ensure logging never crashes the app
		if r := recover(); r != nil {
			// Silently ignore logging errors - logging should never break functionality
			fmt.Fprintf(os.Stderr, "Warning: session log append failed: %v\n", r)
		}
	}()

	a.sessionLogsMutex.Lock()
	defer a.sessionLogsMutex.Unlock()

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logEntry := fmt.Sprintf("[%s] %s", timestamp, entry)
	a.sessionLogs = append(a.sessionLogs, logEntry)

	// Limit log size to prevent memory issues (keep last 10000 entries)
	const maxLogEntries = 10000
	if len(a.sessionLogs) > maxLogEntries {
		a.sessionLogs = a.sessionLogs[len(a.sessionLogs)-maxLogEntries:]
	}
}

// GetSessionLogs returns all session logs as a string
func (a *App) GetSessionLogs() string {
	a.sessionLogsMutex.Lock()
	defer a.sessionLogsMutex.Unlock()

	return strings.Join(a.sessionLogs, "\n")
}

// clearSessionLogs clears all session logs
func (a *App) clearSessionLogs() {
	a.sessionLogsMutex.Lock()
	defer a.sessionLogsMutex.Unlock()
	a.sessionLogs = make([]string, 0)
}

// extractJSONFromBrewOutput extracts the JSON portion from Homebrew command output
// Homebrew may output warnings or error messages before the JSON, which can cause parsing to fail
// This function finds the start of the JSON (either '{' or '[') and returns just the JSON portion
// It also returns any warnings that appeared before the JSON for logging purposes
func extractJSONFromBrewOutput(output string) (jsonOutput string, warnings string, err error) {
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

// parseBrewWarnings parses Homebrew warnings and maps them to specific packages
// Returns a map of package names to their warning messages
func parseBrewWarnings(warnings string) map[string]string {
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

// getBackendMessage returns a translated backend message
func (a *App) getBackendMessage(key string, params map[string]string) string {
	var messages map[string]string

	switch a.currentLanguage {
	case "en":
		messages = map[string]string{
			"updateStart":               "🔄 Starting update for '{{name}}'...",
			"updateSuccess":             "✅ Update for '{{name}}' completed successfully!",
			"updateFailed":              "❌ Update for '{{name}}' failed: {{error}}",
			"updateAllStart":            "🔄 Starting update for all packages...",
			"updateAllSuccess":          "✅ Update for all packages completed successfully!",
			"updateAllFailed":           "❌ Update for all packages failed: {{error}}",
			"updateRetryingWithForce":   "🔄 Retrying update for '{{name}}' with --force (app may be in use)...",
			"updateRetryingFailedCasks": "🔄 Retrying {{count}} failed cask(s) with --force...",
			"installStart":              "🔄 Starting installation for '{{name}}'...",
			"installSuccess":            "✅ Installation for '{{name}}' completed successfully!",
			"installFailed":             "❌ Installation for '{{name}}' failed: {{error}}",
			"uninstallStart":            "🔄 Starting uninstallation for '{{name}}'...",
			"uninstallSuccess":          "✅ Uninstallation for '{{name}}' completed successfully!",
			"uninstallFailed":           "❌ Uninstallation for '{{name}}' failed: {{error}}",
			"errorCreatingPipe":         "❌ Error creating output pipe: {{error}}",
			"errorCreatingErrorPipe":    "❌ Error creating error pipe: {{error}}",
			"errorStartingUpdate":       "❌ Error starting update: {{error}}",
			"errorStartingUpdateAll":    "❌ Error starting update all: {{error}}",
			"errorStartingInstall":      "❌ Error starting installation: {{error}}",
			"errorStartingUninstall":    "❌ Error starting uninstallation: {{error}}",
		}
	case "de":
		messages = map[string]string{
			"updateStart":               "🔄 Starte Update für '{{name}}'...",
			"updateSuccess":             "✅ Update für '{{name}}' erfolgreich abgeschlossen!",
			"updateFailed":              "❌ Update für '{{name}}' fehlgeschlagen: {{error}}",
			"updateAllStart":            "🔄 Starte Update für alle Pakete...",
			"updateAllSuccess":          "✅ Update für alle Pakete erfolgreich abgeschlossen!",
			"updateAllFailed":           "❌ Update für alle Pakete fehlgeschlagen: {{error}}",
			"updateRetryingWithForce":   "🔄 Wiederhole Update für '{{name}}' mit --force (App könnte in Verwendung sein)...",
			"updateRetryingFailedCasks": "🔄 Wiederhole {{count}} fehlgeschlagene Cask(s) mit --force...",
			"installStart":              "🔄 Starte Installation für '{{name}}'...",
			"installSuccess":            "✅ Installation für '{{name}}' erfolgreich abgeschlossen!",
			"installFailed":             "❌ Installation für '{{name}}' fehlgeschlagen: {{error}}",
			"uninstallStart":            "🔄 Starte Deinstallation für '{{name}}'...",
			"uninstallSuccess":          "✅ Deinstallation für '{{name}}' erfolgreich abgeschlossen!",
			"uninstallFailed":           "❌ Deinstallation für '{{name}}' fehlgeschlagen: {{error}}",
			"errorCreatingPipe":         "❌ Fehler beim Erstellen der Ausgabe-Pipe: {{error}}",
			"errorCreatingErrorPipe":    "❌ Fehler beim Erstellen der Fehler-Pipe: {{error}}",
			"errorStartingUpdate":       "❌ Fehler beim Starten des Updates: {{error}}",
			"errorStartingUpdateAll":    "❌ Fehler beim Starten des Updates aller Pakete: {{error}}",
			"errorStartingInstall":      "❌ Fehler beim Starten der Installation: {{error}}",
			"errorStartingUninstall":    "❌ Fehler beim Starten der Deinstallation: {{error}}",
		}
	case "fr":
		messages = map[string]string{
			"updateStart":               "🔄 Démarrage de la mise à jour pour '{{name}}'...",
			"updateSuccess":             "✅ Mise à jour pour '{{name}}' terminée avec succès !",
			"updateFailed":              "❌ Mise à jour pour '{{name}}' échouée : {{error}}",
			"updateAllStart":            "🔄 Démarrage de la mise à jour pour tous les paquets...",
			"updateAllSuccess":          "✅ Mise à jour pour tous les paquets terminée avec succès !",
			"updateAllFailed":           "❌ Mise à jour pour tous les paquets échouée : {{error}}",
			"updateRetryingWithForce":   "🔄 Nouvelle tentative de mise à jour pour '{{name}}' avec --force (l'application peut être en cours d'utilisation)...",
			"updateRetryingFailedCasks": "🔄 Nouvelle tentative pour {{count}} cask(s) ayant échoué avec --force...",
			"installStart":              "🔄 Démarrage de l'installation pour '{{name}}'...",
			"installSuccess":            "✅ Installation pour '{{name}}' terminée avec succès !",
			"installFailed":             "❌ Installation pour '{{name}}' échouée : {{error}}",
			"uninstallStart":            "🔄 Démarrage de la désinstallation pour '{{name}}'...",
			"uninstallSuccess":          "✅ Désinstallation pour '{{name}}' terminée avec succès !",
			"uninstallFailed":           "❌ Désinstallation pour '{{name}}' échouée : {{error}}",
			"errorCreatingPipe":         "❌ Erreur lors de la création du pipe de sortie : {{error}}",
			"errorCreatingErrorPipe":    "❌ Erreur lors de la création du pipe d'erreur : {{error}}",
			"errorStartingUpdate":       "❌ Erreur lors du démarrage de la mise à jour : {{error}}",
			"errorStartingUpdateAll":    "❌ Erreur lors du démarrage de la mise à jour de tous les paquets : {{error}}",
			"errorStartingInstall":      "❌ Erreur lors du démarrage de l'installation : {{error}}",
			"errorStartingUninstall":    "❌ Erreur lors du démarrage de la désinstallation : {{error}}",
		}
	case "tr":
		messages = map[string]string{
			"updateStart":               "🔄 '{{name}}' için güncelleme başlıyor...",
			"updateSuccess":             "✅ '{{name}}' için güncelleme başarıyla tamamlandı!",
			"updateFailed":              "❌ '{{name}}' için güncelleme hata verdi: {{error}}",
			"updateAllStart":            "🔄 Tüm paketler için güncelleme başlıyor...",
			"updateAllSuccess":          "✅ Tüm paketler için güncelleme başarıyla tamamlandı!",
			"updateAllFailed":           "❌ Tüm paketler için güncelleme hata verdi: {{error}}",
			"updateRetryingWithForce":   "🔄 '{{name}}' için güncelleme --force ile yeniden deneniyor (uygulama kullanımda olabilir)...",
			"updateRetryingFailedCasks": "🔄 {{count}} başarısız cask --force ile yeniden deneniyor...",
			"installStart":              "🔄 '{{name}}' için kurulum başlıyor...",
			"installSuccess":            "✅ '{{name}}' için kurulum başarıyla tamamlandı!",
			"installFailed":             "❌ '{{name}}' için kurulum hata verdi: {{error}}",
			"uninstallStart":            "🔄 '{{name}}' kaldırılıyor...",
			"uninstallSuccess":          "✅ '{{name}}' başarıyla kaldırıldı!",
			"uninstallFailed":           "❌ '{{name}}' için kaldırılma hata verdi: {{error}}",
			"errorCreatingPipe":         "❌ Çıktı borusu yaratılırken bir hata oluştu: {{error}}",
			"errorCreatingErrorPipe":    "❌ Hata borusu yaratılırken bir hata oluştu: {{error}}",
			"errorStartingUpdate":       "❌ Güncellenirken bir hata oluştu: {{error}}",
			"errorStartingUpdateAll":    "❌ Tümü güncellenirken bir hata oluştu: {{error}}",
			"errorStartingInstall":      "❌ Kurulurken bir hata oluştu: {{error}}",
			"errorStartingUninstall":    "❌ Kaldırılma başlatılırken bir hata oluştu: {{error}}",
		}
	case "zhCN":
		messages = map[string]string{
			"updateStart":               "🔄 开始更新 '{{name}}'...",
			"updateSuccess":             "✅ '{{name}}' 更新成功！",
			"updateFailed":              "❌ 更新 '{{name}}' 失败：{{error}}",
			"updateAllStart":            "🔄 开始更新所有软件包...",
			"updateAllSuccess":          "✅ 所有软件包的更新已成功完成！",
			"updateAllFailed":           "❌ 所有软件包更新失败：{{error}}",
			"updateRetryingWithForce":   "🔄 使用 --force 重试更新 '{{name}}'（应用可能正在使用中）...",
			"updateRetryingFailedCasks": "🔄 使用 --force 重试 {{count}} 个失败的 cask...",
			"installStart":              "🔄 开始安装 '{{name}}'...",
			"installSuccess":            "✅ '{{name}}' 安装成功！",
			"installFailed":             "❌ '{{name}}' 安装失败：{{error}}",
			"uninstallStart":            "🔄 开始卸载 '{{name}}'...",
			"uninstallSuccess":          "✅ '{{name}}' 卸载成功！",
			"uninstallFailed":           "❌ 卸载 '{{name}}' 失败：{{error}}",
			"errorCreatingPipe":         "❌ 无法建立输出通道：{{error}}",
			"errorCreatingErrorPipe":    "❌ 无法建立错误通道：{{error}}",
			"errorStartingUpdate":       "❌ 准备更新时出错：{{error}}",
			"errorStartingUpdateAll":    "❌ 准备更新所有软件包时出错：{{error}}",
			"errorStartingInstall":      "❌ 准备安装时出错：{{error}}",
			"errorStartingUninstall":    "❌ 准备卸载时出错：{{error}}",
		}
	case "pt_BR":
		messages = map[string]string{
			"updateStart":               "🔄 Iniciando atualização de '{{name}}'...",
			"updateSuccess":             "✅ Atualização de '{{name}}' concluída com sucesso!",
			"updateFailed":              "❌ Falha na atualização de '{{name}}': {{error}}",
			"updateAllStart":            "🔄 Iniciando atualização de todos os pacotes...",
			"updateAllSuccess":          "✅ Atualização de todos os pacotes concluída com sucesso!",
			"updateAllFailed":           "❌ Falha na atualização de todos os pacotes: {{error}}",
			"updateRetryingWithForce":   "🔄 Tentando novamente atualização de '{{name}}' com --force (aplicativo pode estar em uso)...",
			"updateRetryingFailedCasks": "🔄 Tentando novamente {{count}} cask(s) com falha com --force...",
			"installStart":              "🔄 Iniciando instalação de '{{name}}'...",
			"installSuccess":            "✅ Instalação de '{{name}}' concluída com sucesso!",
			"installFailed":             "❌ Falha na instalação de '{{name}}': {{error}}",
			"uninstallStart":            "🔄 Iniciando desinstalação de '{{name}}'...",
			"uninstallSuccess":          "✅ Desinstalação de '{{name}}' concluída com sucesso!",
			"uninstallFailed":           "❌ Falha na desinstalação de '{{name}}': {{error}}",
			"errorCreatingPipe":         "❌ Erro ao criar pipe de saída: {{error}}",
			"errorCreatingErrorPipe":    "❌ Erro ao criar pipe de erro: {{error}}",
			"errorStartingUpdate":       "❌ Erro ao iniciar atualização: {{error}}",
			"errorStartingUpdateAll":    "❌ Erro ao iniciar a atualização de tudo: {{error}}",
			"errorStartingInstall":      "❌ Erro ao iniciar instalação: {{error}}",
			"errorStartingUninstall":    "❌ Erro ao iniciar desinstalação: {{error}}",
		}
	case "ru":
		messages = map[string]string{
			"updateStart":               "🔄 Начинается обновление '{{name}}'...",
			"updateSuccess":             "✅ Обновление '{{name}}' успешно завершено!",
			"updateFailed":              "❌ Не удалось обновить '{{name}}': {{error}}",
			"updateAllStart":            "🔄 Начинается обновление всех пакетов...",
			"updateAllSuccess":          "✅ Обновление всех пакетов успешно завершено!",
			"updateAllFailed":           "❌ Не удалось обновить все пакеты: {{error}}",
			"updateRetryingWithForce":   "🔄 Повторная попытка обновления '{{name}}' с --force (приложение может быть запущено)...",
			"updateRetryingFailedCasks": "🔄 Повторная попытка для {{count}} неудачных cask с --force...",
			"installStart":              "🔄 Начинается установка '{{name}}'...",
			"installSuccess":            "✅ Установка '{{name}}' успешно завершена!",
			"installFailed":             "❌ Не удалось установить '{{name}}': {{error}}",
			"uninstallStart":            "🔄 Начинается удаление '{{name}}'...",
			"uninstallSuccess":          "✅ Удаление '{{name}}' успешно завершено!",
			"uninstallFailed":           "❌ Не удалось удалить '{{name}}': {{error}}",
			"errorCreatingPipe":         "❌ Ошибка создания выходного канала: {{error}}",
			"errorCreatingErrorPipe":    "❌ Ошибка создания канала ошибок: {{error}}",
			"errorStartingUpdate":       "❌ Ошибка запуска обновления: {{error}}",
			"errorStartingUpdateAll":    "❌ Ошибка запуска обновления всех пакетов: {{error}}",
			"errorStartingInstall":      "❌ Ошибка запуска установки: {{error}}",
			"errorStartingUninstall":    "❌ Ошибка запуска удаления: {{error}}",
		}
	default:
		// Default to English
		messages = map[string]string{
			"updateStart":               "🔄 Starting update for '{{name}}'...",
			"updateSuccess":             "✅ Update for '{{name}}' completed successfully!",
			"updateFailed":              "❌ Update for '{{name}}' failed: {{error}}",
			"updateAllStart":            "🔄 Starting update for all packages...",
			"updateAllSuccess":          "✅ Update for all packages completed successfully!",
			"updateAllFailed":           "❌ Update for all packages failed: {{error}}",
			"updateRetryingWithForce":   "🔄 Retrying update for '{{name}}' with --force (app may be in use)...",
			"updateRetryingFailedCasks": "🔄 Retrying {{count}} failed cask(s) with --force...",
			"installStart":              "🔄 Starting installation for '{{name}}'...",
			"installSuccess":            "✅ Installation for '{{name}}' completed successfully!",
			"installFailed":             "❌ Installation for '{{name}}' failed: {{error}}",
			"uninstallStart":            "🔄 Starting uninstallation for '{{name}}'...",
			"uninstallSuccess":          "✅ Uninstallation for '{{name}}' completed successfully!",
			"uninstallFailed":           "❌ Uninstallation for '{{name}}' failed: {{error}}",
			"errorCreatingPipe":         "❌ Error creating output pipe: {{error}}",
			"errorCreatingErrorPipe":    "❌ Error creating error pipe: {{error}}",
			"errorStartingUpdate":       "❌ Error starting update: {{error}}",
			"errorStartingUpdateAll":    "❌ Error starting update all: {{error}}",
			"errorStartingInstall":      "❌ Error starting installation: {{error}}",
			"errorStartingUninstall":    "❌ Error starting uninstallation: {{error}}",
		}
	}

	message, exists := messages[key]
	if !exists {
		return key // Return the key if translation not found
	}

	// Replace parameters
	for param, value := range params {
		message = strings.ReplaceAll(message, "{{"+param+"}}", value)
	}

	return message
}

func (a *App) menu() *menu.Menu {
	translations := a.getMenuTranslations()
	AppMenu := menu.NewMenu()

	// App Menü (macOS-like)
	AppSubmenu := AppMenu.AddSubmenu("WailBrew")
	AppSubmenu.AddText(translations.App.About, nil, func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "showAbout")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(translations.View.Settings, keys.CmdOrCtrl(","), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "settings")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(translations.App.CheckUpdates, nil, func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "checkForUpdates")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(translations.App.VisitWebsite, nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://wailbrew.app")
	})
	AppSubmenu.AddText(translations.App.VisitGitHub, nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://github.com/wickenico/WailBrew")
	})
	AppSubmenu.AddText(translations.App.ReportBug, nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://github.com/wickenico/WailBrew/issues")
	})
	AppSubmenu.AddText(translations.App.VisitSubreddit, nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://www.reddit.com/r/WailBrew/")
	})
	AppSubmenu.AddText(translations.App.SponsorProject, nil, func(cd *menu.CallbackData) {
		a.OpenURL("https://github.com/sponsors/wickenico")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(translations.App.Quit, keys.CmdOrCtrl("q"), func(cd *menu.CallbackData) {
		rt.Quit(a.ctx)
	})

	ViewMenu := AppMenu.AddSubmenu(translations.View.Title)
	ViewMenu.AddText(translations.View.Installed, keys.CmdOrCtrl("1"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "installed")
	})
	ViewMenu.AddText(translations.View.Casks, keys.CmdOrCtrl("2"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "casks")
	})
	ViewMenu.AddText(translations.View.Outdated, keys.CmdOrCtrl("3"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "updatable")
	})
	ViewMenu.AddText(translations.View.All, keys.CmdOrCtrl("4"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "all")
	})
	ViewMenu.AddText(translations.View.Leaves, keys.CmdOrCtrl("5"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "leaves")
	})
	ViewMenu.AddText(translations.View.Repositories, keys.CmdOrCtrl("6"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "repositories")
	})
	ViewMenu.AddSeparator()
	ViewMenu.AddText(translations.View.Homebrew, keys.CmdOrCtrl("7"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "homebrew")
	})
	ViewMenu.AddText(translations.View.Doctor, keys.CmdOrCtrl("8"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "doctor")
	})
	ViewMenu.AddText(translations.View.Cleanup, keys.CmdOrCtrl("9"), func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "setView", "cleanup")
	})

	// Tools Menu
	ToolsMenu := AppMenu.AddSubmenu(translations.Tools.Title)
	ToolsMenu.AddText(translations.Tools.ExportBrewfile, keys.CmdOrCtrl("e"), func(cd *menu.CallbackData) {
		// Open file picker dialog to save Brewfile
		saveDialog, err := rt.SaveFileDialog(a.ctx, rt.SaveDialogOptions{
			DefaultFilename:      "Brewfile",
			Title:                translations.Tools.ExportBrewfile,
			CanCreateDirectories: true,
		})

		if err == nil && saveDialog != "" {
			err := a.ExportBrewfile(saveDialog)
			if err != nil {
				rt.MessageDialog(a.ctx, rt.MessageDialogOptions{
					Type:    rt.ErrorDialog,
					Title:   translations.Tools.ExportFailed,
					Message: fmt.Sprintf("Failed to export Brewfile: %v", err),
				})
			} else {
				rt.MessageDialog(a.ctx, rt.MessageDialogOptions{
					Type:    rt.InfoDialog,
					Title:   translations.Tools.ExportSuccess,
					Message: fmt.Sprintf(translations.Tools.ExportMessage, saveDialog),
				})
			}
		}
	})
	ToolsMenu.AddSeparator()
	ToolsMenu.AddText(translations.Tools.ViewSessionLogs, nil, func(cd *menu.CallbackData) {
		rt.EventsEmit(a.ctx, "showSessionLogs")
	})

	// Edit-Menü (optional)
	if runtime.GOOS == "darwin" {
		AppMenu.Append(menu.EditMenu())
		AppMenu.Append(menu.WindowMenu())
	}

	HelpMenu := AppMenu.AddSubmenu(translations.Help.Title)
	HelpMenu.AddText(translations.Help.WailbrewHelp, nil, func(cd *menu.CallbackData) {
		rt.MessageDialog(a.ctx, rt.MessageDialogOptions{
			Type:    rt.InfoDialog,
			Title:   translations.Help.HelpTitle,
			Message: translations.Help.HelpMessage,
		})
	})

	return AppMenu
}

func (a *App) GetAllBrewPackages() [][]string {
	output, err := a.runBrewCommand("formulae")
	if err != nil {
		// On error, return a helpful message instead of crashing
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch all packages: %v. This often happens on fresh Homebrew installations. Try refreshing after a few minutes.", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var results [][]string

	// Initialize known packages on first call
	a.knownPackagesMutex.Lock()
	if len(a.knownPackages) == 0 {
		// First time - initialize with current packages
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line != "" {
				a.knownPackages["formula:"+line] = true
			}
		}
		// Also add casks
		caskOutput, err := a.runBrewCommand("casks")
		if err == nil {
			caskLines := strings.Split(strings.TrimSpace(string(caskOutput)), "\n")
			for _, line := range caskLines {
				line = strings.TrimSpace(line)
				if line != "" {
					a.knownPackages["cask:"+line] = true
				}
			}
		}
	}
	a.knownPackagesMutex.Unlock()

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			// For all packages (not installed), we don't have version or size yet
			results = append(results, []string{line, "", ""})
		}
	}

	return results
}

// GetBrewPackages retrieves the list of installed Homebrew packages with size information
func (a *App) GetBrewPackages() [][]string {
	// Validate brew installation first
	if err := a.validateBrewInstallation(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	output, err := a.runBrewCommand("list", "--formula", "--versions")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch installed packages: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		// No packages installed, return empty list instead of error
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var packageNames []string
	packageVersions := make(map[string]string)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) >= 2 {
			packageNames = append(packageNames, parts[0])
			packageVersions[parts[0]] = parts[1]
		} else if len(parts) == 1 {
			packageNames = append(packageNames, parts[0])
			packageVersions[parts[0]] = "Unknown"
		}
	}

	// Get size information using brew info --json
	packageSizes := a.getPackageSizes(packageNames, false)

	// Build result with name, version, and size
	var packages [][]string
	for _, name := range packageNames {
		version := packageVersions[name]
		size := packageSizes[name]
		packages = append(packages, []string{name, version, size})
	}

	return packages
}

// getPackageSizes fetches size information for packages
func (a *App) getPackageSizes(packageNames []string, isCask bool) map[string]string {
	sizes := make(map[string]string)

	if len(packageNames) == 0 {
		return sizes
	}

	// Build brew info command
	args := []string{"info", "--json=v2"}
	if isCask {
		args = append(args, "--cask")
	}
	args = append(args, packageNames...)

	output, err := a.runBrewCommand(args...)
	if err != nil {
		// If batch fails, return empty sizes
		for _, name := range packageNames {
			sizes[name] = "Unknown"
		}
		return sizes
	}

	// Extract JSON portion from output (handling potential Homebrew warnings)
	outputStr := strings.TrimSpace(string(output))
	jsonOutput, warnings, err := extractJSONFromBrewOutput(outputStr)
	if err != nil {
		// If JSON extraction fails, return unknown sizes
		for _, name := range packageNames {
			sizes[name] = "Unknown"
		}
		return sizes
	}

	// Log warnings if any were detected
	if warnings != "" {
		a.appendSessionLog(fmt.Sprintf("Homebrew warnings in package sizes: %s", warnings))
	}

	// Parse JSON response
	var brewInfo struct {
		Formulae []struct {
			Name      string `json:"name"`
			Installed []struct {
				InstalledOnDemand bool  `json:"installed_on_demand"`
				UsedOptions       []any `json:"used_options"`
				BuiltAsBottle     bool  `json:"built_as_bottle"`
				Poured            bool  `json:"poured_from_bottle"`
				Time              int64 `json:"time"`
				RuntimeDeps       []any `json:"runtime_dependencies"`
				InstalledAsDep    bool  `json:"installed_as_dependency"`
				InstalledWithOpts []any `json:"installed_with_options"`
			} `json:"installed"`
		} `json:"formulae"`
		Casks []struct {
			Token     string `json:"token"`
			Installed string `json:"installed"`
		} `json:"casks"`
	}

	if err := json.Unmarshal([]byte(jsonOutput), &brewInfo); err != nil {
		for _, name := range packageNames {
			sizes[name] = "Unknown"
		}
		return sizes
	}

	// For formulae, calculate size from cellar
	if !isCask {
		for _, formula := range brewInfo.Formulae {
			size := a.calculateFormulaSize(formula.Name)
			sizes[formula.Name] = size
		}
	} else {
		// For casks, calculate size from caskroom
		for _, cask := range brewInfo.Casks {
			size := a.calculateCaskSize(cask.Token)
			sizes[cask.Token] = size
		}
	}

	// Fill in any missing sizes
	for _, name := range packageNames {
		if _, exists := sizes[name]; !exists {
			sizes[name] = "Unknown"
		}
	}

	return sizes
}

// calculateFormulaSize calculates the disk size of an installed formula
func (a *App) calculateFormulaSize(formulaName string) string {
	// Get formula path in cellar
	cellarPath := ""
	if runtime.GOOS == "darwin" {
		if runtime.GOARCH == "arm64" {
			cellarPath = fmt.Sprintf("/opt/homebrew/Cellar/%s", formulaName)
		} else {
			cellarPath = fmt.Sprintf("/usr/local/Cellar/%s", formulaName)
		}
	}

	// Use du command to get directory size
	cmd := exec.Command("du", "-sh", cellarPath)
	output, err := cmd.Output()
	if err != nil {
		return "Unknown"
	}

	// Parse du output (format: "SIZE	PATH")
	parts := strings.Fields(string(output))
	if len(parts) >= 1 {
		return parts[0]
	}

	return "Unknown"
}

// calculateCaskSize calculates the disk size of an installed cask
func (a *App) calculateCaskSize(caskName string) string {
	// Get cask path in caskroom
	caskroomPath := ""
	if runtime.GOOS == "darwin" {
		if runtime.GOARCH == "arm64" {
			caskroomPath = fmt.Sprintf("/opt/homebrew/Caskroom/%s", caskName)
		} else {
			caskroomPath = fmt.Sprintf("/usr/local/Caskroom/%s", caskName)
		}
	}

	// Use du command to get directory size
	cmd := exec.Command("du", "-sh", caskroomPath)
	output, err := cmd.Output()
	if err != nil {
		return "Unknown"
	}

	// Parse du output (format: "SIZE	PATH")
	parts := strings.Fields(string(output))
	if len(parts) >= 1 {
		return parts[0]
	}

	return "Unknown"
}

// GetBrewCasks retrieves the list of installed Homebrew casks
func (a *App) GetBrewCasks() [][]string {
	// Validate brew installation first
	if err := a.validateBrewInstallation(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	// Get list of cask names only (more reliable than --versions)
	output, err := a.runBrewCommand("list", "--cask")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch installed casks: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		// No casks installed, return empty list instead of error
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var caskNames []string
	for _, line := range lines {
		caskName := strings.TrimSpace(line)
		if caskName != "" {
			caskNames = append(caskNames, caskName)
		}
	}

	if len(caskNames) == 0 {
		return [][]string{}
	}

	var casks [][]string
	versionMap := make(map[string]string)

	// Try to get all cask info at once first
	args := []string{"info", "--cask", "--json=v2"}
	args = append(args, caskNames...)

	infoOutput, err := a.runBrewCommand(args...)
	if err == nil {
		// Parse JSON to get versions
		var caskInfo struct {
			Casks []struct {
				Token   string `json:"token"`
				Version string `json:"version"`
			} `json:"casks"`
		}

		if err := json.Unmarshal(infoOutput, &caskInfo); err == nil {
			// Create a map for easy lookup
			for _, cask := range caskInfo.Casks {
				version := cask.Version
				if version == "" {
					version = "Unknown"
				}
				versionMap[cask.Token] = version
			}
		}
	}

	// If batch fetch fails, try individually
	if len(versionMap) == 0 {
		for _, caskName := range caskNames {
			infoOutput, err := a.runBrewCommand("info", "--cask", "--json=v2", caskName)
			if err != nil {
				versionMap[caskName] = "Unknown"
				continue
			}

			var caskInfo struct {
				Casks []struct {
					Version string `json:"version"`
				} `json:"casks"`
			}

			if err := json.Unmarshal(infoOutput, &caskInfo); err == nil && len(caskInfo.Casks) > 0 {
				version := caskInfo.Casks[0].Version
				if version == "" {
					version = "Unknown"
				}
				versionMap[caskName] = version
			} else {
				versionMap[caskName] = "Unknown"
			}
		}
	}

	// Get size information
	caskSizes := a.getPackageSizes(caskNames, true)

	// Build result array with name, version, and size
	for _, name := range caskNames {
		version := versionMap[name]
		if version == "" {
			version = "Unknown"
		}
		size := caskSizes[name]
		casks = append(casks, []string{name, version, size})
	}

	return casks
}

// UpdateBrewDatabase updates the Homebrew formula database
// It uses a mutex to ensure only one update runs at a time and caches the result
// for 5 minutes to avoid redundant updates
func (a *App) UpdateBrewDatabase() error {
	a.updateMutex.Lock()
	defer a.updateMutex.Unlock()

	// If we updated less than 5 minutes ago, skip the update
	if time.Since(a.lastUpdateTime) < 5*time.Minute {
		return nil
	}

	// Run brew update to refresh the local formula database
	_, err := a.runBrewCommandWithTimeout(60*time.Second, "update")

	// Update the timestamp even if there was an error, to avoid hammering
	// the update command if there's a persistent issue
	a.lastUpdateTime = time.Now()

	return err
}

// UpdateBrewDatabaseWithOutput updates the Homebrew formula database and returns the output
// This version captures the output to detect new packages
func (a *App) UpdateBrewDatabaseWithOutput() (string, error) {
	a.updateMutex.Lock()
	defer a.updateMutex.Unlock()

	// If we updated less than 5 minutes ago, skip the update
	if time.Since(a.lastUpdateTime) < 5*time.Minute {
		return "", nil
	}

	// Run brew update to refresh the local formula database
	output, err := a.runBrewCommandWithTimeout(60*time.Second, "update")

	// Update the timestamp even if there was an error, to avoid hammering
	// the update command if there's a persistent issue
	a.lastUpdateTime = time.Now()

	return string(output), err
}

// ParseNewPackagesFromUpdateOutput parses brew update output to extract new formulae and casks
func (a *App) ParseNewPackagesFromUpdateOutput(output string) *NewPackagesInfo {
	info := &NewPackagesInfo{
		NewFormulae: []string{},
		NewCasks:    []string{},
	}

	if output == "" {
		return info
	}

	lines := strings.Split(output, "\n")
	inNewFormulae := false
	inNewCasks := false

	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Detect section headers
		if strings.Contains(line, "==> New Formulae") {
			inNewFormulae = true
			inNewCasks = false
			continue
		}
		if strings.Contains(line, "==> New Casks") {
			inNewFormulae = false
			inNewCasks = true
			continue
		}
		// Stop when we hit another section
		if strings.HasPrefix(line, "==>") {
			inNewFormulae = false
			inNewCasks = false
			continue
		}

		// Parse package names (format: "package-name: Description")
		if inNewFormulae || inNewCasks {
			// Extract package name (everything before the colon)
			parts := strings.SplitN(line, ":", 2)
			if len(parts) > 0 {
				packageName := strings.TrimSpace(parts[0])
				if packageName != "" {
					if inNewFormulae {
						info.NewFormulae = append(info.NewFormulae, packageName)
					} else if inNewCasks {
						info.NewCasks = append(info.NewCasks, packageName)
					}
				}
			}
		}
	}

	return info
}

// CheckForNewPackages checks for new packages and returns information about newly discovered ones
func (a *App) CheckForNewPackages() (*NewPackagesInfo, error) {
	// Get current list of all packages
	allFormulae, err := a.runBrewCommand("formulae")
	if err != nil {
		return nil, fmt.Errorf("failed to get formulae list: %w", err)
	}

	allCasks, err := a.runBrewCommand("casks")
	if err != nil {
		return nil, fmt.Errorf("failed to get casks list: %w", err)
	}

	// Parse current packages
	currentPackages := make(map[string]bool)

	formulaeLines := strings.Split(strings.TrimSpace(string(allFormulae)), "\n")
	for _, line := range formulaeLines {
		name := strings.TrimSpace(line)
		if name != "" {
			currentPackages["formula:"+name] = true
		}
	}

	caskLines := strings.Split(strings.TrimSpace(string(allCasks)), "\n")
	for _, line := range caskLines {
		name := strings.TrimSpace(line)
		if name != "" {
			currentPackages["cask:"+name] = true
		}
	}

	// Compare with known packages
	a.knownPackagesMutex.Lock()
	defer a.knownPackagesMutex.Unlock()

	newInfo := &NewPackagesInfo{
		NewFormulae: []string{},
		NewCasks:    []string{},
	}

	// If knownPackages is empty, this is the first call - initialize it
	// and don't report all packages as "new"
	if len(a.knownPackages) == 0 {
		a.knownPackages = currentPackages
		return newInfo, nil
	}

	// Find new packages
	for pkg := range currentPackages {
		if !a.knownPackages[pkg] {
			// This is a new package
			if strings.HasPrefix(pkg, "formula:") {
				newInfo.NewFormulae = append(newInfo.NewFormulae, strings.TrimPrefix(pkg, "formula:"))
			} else if strings.HasPrefix(pkg, "cask:") {
				newInfo.NewCasks = append(newInfo.NewCasks, strings.TrimPrefix(pkg, "cask:"))
			}
		}
	}

	// Update known packages
	a.knownPackages = currentPackages

	return newInfo, nil
}

// GetBrewUpdatablePackages checks which packages have updates available using brew outdated
func (a *App) GetBrewUpdatablePackages() [][]string {
	// Validate brew installation first
	if err := a.validateBrewInstallation(); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Homebrew validation failed: %v", err)}}
	}

	// Update the formula database first to get latest information
	// Ignore errors from update - we'll still try to get outdated packages
	updateOutput, err := a.UpdateBrewDatabaseWithOutput()
	var newPackages *NewPackagesInfo
	var shouldEmitEvent bool

	if err == nil && updateOutput != "" {
		// Try to detect new packages from update output
		newPackages = a.ParseNewPackagesFromUpdateOutput(updateOutput)
		if len(newPackages.NewFormulae) > 0 || len(newPackages.NewCasks) > 0 {
			// Update knownPackages to prevent duplicate notifications
			a.knownPackagesMutex.Lock()
			for _, formula := range newPackages.NewFormulae {
				a.knownPackages["formula:"+formula] = true
			}
			for _, cask := range newPackages.NewCasks {
				a.knownPackages["cask:"+cask] = true
			}
			a.knownPackagesMutex.Unlock()
			shouldEmitEvent = true
		}
	} else {
		// Fallback: try to detect new packages by comparing current list
		detectedPackages, err := a.CheckForNewPackages()
		if err == nil && (len(detectedPackages.NewFormulae) > 0 || len(detectedPackages.NewCasks) > 0) {
			newPackages = detectedPackages
			shouldEmitEvent = true
		}
	}

	// Emit event only once if new packages were discovered
	if shouldEmitEvent && newPackages != nil && a.ctx != nil {
		eventData := map[string]interface{}{
			"newFormulae": newPackages.NewFormulae,
			"newCasks":    newPackages.NewCasks,
		}
		jsonData, _ := json.Marshal(eventData)
		rt.EventsEmit(a.ctx, "newPackagesDiscovered", string(jsonData))
	}

	// Use brew outdated with JSON output for accurate detection
	// --greedy flag also includes auto-updating casks
	output, err := a.runBrewCommand("outdated", "--json=v2", "--greedy")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to check for updates: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	// If output is empty or "[]", no packages are outdated
	if outputStr == "" || outputStr == "[]" {
		return [][]string{}
	}

	// Extract JSON portion from output (in case there are warnings before the JSON)
	jsonOutput, warnings, err := extractJSONFromBrewOutput(outputStr)
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to extract JSON from brew outdated output: %v", err)}}
	}

	// Parse warnings to map them to specific packages
	warningMap := parseBrewWarnings(warnings)

	// Log warnings if any were detected
	if warnings != "" {
		a.appendSessionLog(fmt.Sprintf("Homebrew warnings detected:\n%s", warnings))
	}

	// Parse JSON response from brew outdated
	var brewOutdated struct {
		Formulae []struct {
			Name              string   `json:"name"`
			InstalledVersions []string `json:"installed_versions"`
			CurrentVersion    string   `json:"current_version"`
			Pinned            bool     `json:"pinned"`
			PinnedVersion     string   `json:"pinned_version"`
		} `json:"formulae"`
		Casks []struct {
			Name              string   `json:"name"`
			InstalledVersions []string `json:"installed_versions"`
			CurrentVersion    string   `json:"current_version"`
		} `json:"casks"`
	}

	if err := json.Unmarshal([]byte(jsonOutput), &brewOutdated); err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to parse outdated packages: %v", err)}}
	}

	var updatablePackages [][]string
	var formulaeNames []string
	var caskNames []string

	// Process formulae (packages)
	for _, formula := range brewOutdated.Formulae {
		// Skip pinned packages as they won't be updated
		if formula.Pinned {
			continue
		}

		installedVersion := "unknown"
		if len(formula.InstalledVersions) > 0 {
			installedVersion = formula.InstalledVersions[0]
		}

		formulaeNames = append(formulaeNames, formula.Name)

		// Get warning for this package if any
		warning := ""
		if w, found := warningMap[formula.Name]; found {
			warning = w
		}

		updatablePackages = append(updatablePackages, []string{
			formula.Name,
			installedVersion,
			formula.CurrentVersion,
			"",      // size placeholder, will be filled below
			warning, // warning message
		})
	}

	// Process casks (applications)
	for _, cask := range brewOutdated.Casks {
		installedVersion := "unknown"
		if len(cask.InstalledVersions) > 0 {
			installedVersion = cask.InstalledVersions[0]
		}

		caskNames = append(caskNames, cask.Name)

		// Get warning for this cask if any
		warning := ""
		if w, found := warningMap[cask.Name]; found {
			warning = w
		}

		updatablePackages = append(updatablePackages, []string{
			cask.Name,
			installedVersion,
			cask.CurrentVersion,
			"",      // size placeholder, will be filled below
			warning, // warning message
		})
	}

	// Get size information for all packages
	formulaeSizes := a.getPackageSizes(formulaeNames, false)
	caskSizes := a.getPackageSizes(caskNames, true)

	// Fill in size information
	for i := range updatablePackages {
		name := updatablePackages[i][0]
		if size, found := formulaeSizes[name]; found {
			updatablePackages[i][3] = size
		} else if size, found := caskSizes[name]; found {
			updatablePackages[i][3] = size
		} else {
			updatablePackages[i][3] = "Unknown"
		}
	}

	return updatablePackages
}

func (a *App) GetBrewLeaves() []string {
	output, err := a.runBrewCommand("leaves")
	if err != nil {
		return []string{fmt.Sprintf("Error: %v", err)}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return []string{}
	}

	lines := strings.Split(outputStr, "\n")
	var results []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			results = append(results, line)
		}
	}

	return results
}

func (a *App) GetBrewTaps() [][]string {
	output, err := a.runBrewCommand("tap")
	if err != nil {
		return [][]string{{"Error", fmt.Sprintf("Failed to fetch repositories: %v", err)}}
	}

	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return [][]string{}
	}

	lines := strings.Split(outputStr, "\n")
	var taps [][]string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			taps = append(taps, []string{line, "Active"})
		}
	}

	return taps
}

// RemoveBrewPackage uninstalls a package with live progress updates
func (a *App) RemoveBrewPackage(packageName string) string {
	// Emit initial progress
	startMessage := a.getBackendMessage("uninstallStart", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageUninstallProgress", startMessage)

	cmd := exec.Command(a.brewPath, "uninstall", packageName)
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUninstallProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUninstallProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := a.getBackendMessage("errorStartingUninstall", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUninstallProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUninstallProgress", fmt.Sprintf("🗑️ %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUninstallProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()
	if err != nil {
		errorMsg := a.getBackendMessage("uninstallFailed", map[string]string{"name": packageName, "error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUninstallProgress", errorMsg)
		rt.EventsEmit(a.ctx, "packageUninstallComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := a.getBackendMessage("uninstallSuccess", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageUninstallProgress", successMsg)
	rt.EventsEmit(a.ctx, "packageUninstallComplete", successMsg)
	return successMsg
}

// InstallBrewPackage installs a package with live progress updates
func (a *App) InstallBrewPackage(packageName string) string {
	// Emit initial progress
	startMessage := a.getBackendMessage("installStart", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageInstallProgress", startMessage)

	cmd := exec.Command(a.brewPath, "install", packageName)
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageInstallProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageInstallProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := a.getBackendMessage("errorStartingInstall", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageInstallProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageInstallProgress", fmt.Sprintf("📦 %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageInstallProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()
	if err != nil {
		errorMsg := a.getBackendMessage("installFailed", map[string]string{"name": packageName, "error": err.Error()})
		rt.EventsEmit(a.ctx, "packageInstallProgress", errorMsg)
		rt.EventsEmit(a.ctx, "packageInstallComplete", errorMsg)
		return errorMsg
	}

	// Success
	successMsg := a.getBackendMessage("installSuccess", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageInstallProgress", successMsg)
	rt.EventsEmit(a.ctx, "packageInstallComplete", successMsg)
	return successMsg
}

// isPackageCask checks if a package is a cask
func (a *App) isPackageCask(packageName string) bool {
	output, err := a.runBrewCommand("info", "--json=v2", packageName)
	if err != nil {
		return false
	}

	outputStr := strings.TrimSpace(string(output))
	jsonOutput, _, err := extractJSONFromBrewOutput(outputStr)
	if err != nil {
		return false
	}

	var result struct {
		Formulae []map[string]interface{} `json:"formulae"`
		Casks    []map[string]interface{} `json:"casks"`
	}
	if err := json.Unmarshal([]byte(jsonOutput), &result); err != nil {
		return false
	}

	// If found in casks but not in formulae, it's a cask
	return len(result.Casks) > 0 && len(result.Formulae) == 0
}

// isAppAlreadyExistsError checks if the error is the "app already exists" error
func (a *App) isAppAlreadyExistsError(stderrOutput string) bool {
	return strings.Contains(stderrOutput, "It seems there is already an app at") ||
		strings.Contains(stderrOutput, "already an App at")
}

// extractFailedPackagesFromError extracts package names from "app already exists" errors
func (a *App) extractFailedPackagesFromError(stderrOutput string) []string {
	var failedPackages []string
	lines := strings.Split(stderrOutput, "\n")
	for _, line := range lines {
		// Error format: "Error: package-name: It seems there is already an app at..."
		if strings.Contains(line, "It seems there is already an app at") ||
			strings.Contains(line, "already an App at") {
			// Try to extract package name
			// Format is typically: "Error: package-name: It seems..."
			parts := strings.Split(line, ":")
			if len(parts) >= 3 {
				// Format: "Error" : "package-name" : "It seems..."
				pkgName := strings.TrimSpace(parts[1])
				if pkgName != "" {
					failedPackages = append(failedPackages, pkgName)
				}
			} else if len(parts) >= 2 {
				// Fallback: "package-name: It seems..."
				pkgName := strings.TrimSpace(parts[0])
				if pkgName != "" && !strings.Contains(pkgName, "Error") {
					failedPackages = append(failedPackages, pkgName)
				}
			}
		}
	}
	return failedPackages
}

// UpdateBrewPackage upgrades a package with live progress updates
func (a *App) UpdateBrewPackage(packageName string) string {
	// Emit initial progress
	startMessage := a.getBackendMessage("updateStart", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageUpdateProgress", startMessage)

	// Try normal upgrade first
	finalMessage, wailbrewUpdated, shouldRetry := a.runUpdateCommand(packageName, false)

	// If update failed with "app already exists" error and it's a cask, retry with --force
	if shouldRetry && a.isPackageCask(packageName) {
		rt.EventsEmit(a.ctx, "packageUpdateProgress", a.getBackendMessage("updateRetryingWithForce", map[string]string{"name": packageName}))
		finalMessage, wailbrewUpdated, _ = a.runUpdateCommand(packageName, true)
	}

	// Signal completion
	rt.EventsEmit(a.ctx, "packageUpdateComplete", finalMessage)

	// If WailBrew was updated, emit event to show restart dialog
	if wailbrewUpdated && a.ctx != nil {
		rt.EventsEmit(a.ctx, "wailbrewUpdated")
	}

	return finalMessage
}

// runUpdateCommand executes the brew upgrade command and returns the result
func (a *App) runUpdateCommand(packageName string, useForce bool) (finalMessage string, wailbrewUpdated bool, shouldRetry bool) {
	args := []string{"upgrade"}
	if useForce {
		args = append(args, "--force")
	}
	args = append(args, packageName)

	cmd := exec.Command(a.brewPath, args...)
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := a.getBackendMessage("errorStartingUpdate", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg, false, false
	}

	// Capture stderr for error detection
	var stderrOutput strings.Builder

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("📦 %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				stderrOutput.WriteString(line)
				stderrOutput.WriteString("\n")
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	if err != nil {
		stderrStr := stderrOutput.String()
		// Check if this is the "app already exists" error and we haven't tried --force yet
		if !useForce && a.isAppAlreadyExistsError(stderrStr) {
			return "", false, true
		}
		finalMessage = a.getBackendMessage("updateFailed", map[string]string{"name": packageName, "error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
		return finalMessage, false, false
	}

	finalMessage = a.getBackendMessage("updateSuccess", map[string]string{"name": packageName})
	rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)

	// Check if WailBrew itself was updated
	if strings.ToLower(packageName) == "wailbrew" {
		wailbrewUpdated = true
	}

	return finalMessage, wailbrewUpdated, false
}

// UpdateSelectedBrewPackages upgrades specific packages with live progress updates
func (a *App) UpdateSelectedBrewPackages(packageNames []string) string {
	// Validate brew installation first
	if err := a.validateBrewInstallation(); err != nil {
		return fmt.Sprintf("❌ Homebrew validation failed: %v", err)
	}

	if len(packageNames) == 0 {
		return "❌ No packages selected for update"
	}

	// Build brew upgrade command with specific packages
	args := []string{"upgrade"}
	args = append(args, packageNames...)

	cmd := exec.Command(a.brewPath, args...)
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Sprintf("❌ Error creating output pipe: %v", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Sprintf("❌ Error creating error pipe: %v", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Sprintf("❌ Error starting update: %v", err)
	}

	// Track which packages were updated (especially wailbrew)
	updatedPackages := make(map[string]bool)
	var stderrOutput strings.Builder

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("📦 %s", line))

				// Detect if wailbrew is being updated
				if strings.Contains(strings.ToLower(line), "wailbrew") {
					if strings.Contains(line, "Upgrading") || strings.Contains(line, "Installing") {
						parts := strings.Fields(line)
						for i, part := range parts {
							if (part == "Upgrading" || part == "Installing") && i+1 < len(parts) {
								pkgName := strings.ToLower(parts[i+1])
								pkgName = strings.Trim(pkgName, ":.,!?")
								if pkgName == "wailbrew" {
									updatedPackages["wailbrew"] = true
								}
							}
						}
					}
					if strings.Contains(line, "successfully") && strings.Contains(strings.ToLower(line), "wailbrew") {
						updatedPackages["wailbrew"] = true
					}
				}
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				stderrOutput.WriteString(line)
				stderrOutput.WriteString("\n")
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	var finalMessage string
	if err != nil {
		stderrStr := stderrOutput.String()
		// Check if this is the "app already exists" error
		if a.isAppAlreadyExistsError(stderrStr) {
			// Extract failed package names
			failedPackages := a.extractFailedPackagesFromError(stderrStr)
			// Filter to only casks
			var failedCasks []string
			for _, pkg := range failedPackages {
				if a.isPackageCask(pkg) {
					failedCasks = append(failedCasks, pkg)
				}
			}

			// Retry failed casks with --force
			if len(failedCasks) > 0 {
				rt.EventsEmit(a.ctx, "packageUpdateProgress", a.getBackendMessage("updateRetryingFailedCasks", map[string]string{"count": fmt.Sprintf("%d", len(failedCasks))}))
				for _, pkg := range failedCasks {
					rt.EventsEmit(a.ctx, "packageUpdateProgress", a.getBackendMessage("updateRetryingWithForce", map[string]string{"name": pkg}))
					_, _, _ = a.runUpdateCommand(pkg, true)
				}
				finalMessage = fmt.Sprintf("✅ Retried %d failed cask(s) with --force", len(failedCasks))
			} else {
				finalMessage = fmt.Sprintf("❌ Update failed for selected packages: %v", err)
			}
		} else {
			finalMessage = fmt.Sprintf("❌ Update failed for selected packages: %v", err)
		}
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	} else {
		finalMessage = fmt.Sprintf("✅ Successfully updated %d selected package(s)", len(packageNames))
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	}

	// Signal completion
	rt.EventsEmit(a.ctx, "packageUpdateComplete", finalMessage)

	// If WailBrew was updated, emit event to show restart dialog
	if updatedPackages["wailbrew"] && a.ctx != nil {
		rt.EventsEmit(a.ctx, "wailbrewUpdated")
	}

	return finalMessage
}

// UpdateAllBrewPackages upgrades all outdated packages with live progress updates
func (a *App) UpdateAllBrewPackages() string {
	// Emit initial progress
	startMessage := a.getBackendMessage("updateAllStart", map[string]string{})
	rt.EventsEmit(a.ctx, "packageUpdateProgress", startMessage)

	// Use --greedy flag to also update casks (including auto-updating ones)
	cmd := exec.Command(a.brewPath, "upgrade", "--greedy")
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := a.getBackendMessage("errorCreatingErrorPipe", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := a.getBackendMessage("errorStartingUpdateAll", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", errorMsg)
		return errorMsg
	}

	// Track which packages are being updated
	updatedPackages := make(map[string]bool)

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("📦 %s", line))

				// Detect if wailbrew is being updated
				// Look for patterns like "==> Upgrading wailbrew" or "wailbrew was successfully upgraded"
				if strings.Contains(strings.ToLower(line), "wailbrew") {
					// Try to extract package name from lines like "==> Upgrading wailbrew"
					if strings.Contains(line, "Upgrading") || strings.Contains(line, "Installing") {
						parts := strings.Fields(line)
						for i, part := range parts {
							if (part == "Upgrading" || part == "Installing") && i+1 < len(parts) {
								pkgName := strings.ToLower(parts[i+1])
								// Remove any trailing punctuation
								pkgName = strings.Trim(pkgName, ":.,!?")
								if pkgName == "wailbrew" {
									updatedPackages["wailbrew"] = true
								}
							}
						}
					}
					// Also check for success messages
					if strings.Contains(line, "successfully") && strings.Contains(strings.ToLower(line), "wailbrew") {
						updatedPackages["wailbrew"] = true
					}
				}
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "packageUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	var finalMessage string
	if err != nil {
		finalMessage = a.getBackendMessage("updateAllFailed", map[string]string{"error": err.Error()})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	} else {
		finalMessage = a.getBackendMessage("updateAllSuccess", map[string]string{})
		rt.EventsEmit(a.ctx, "packageUpdateProgress", finalMessage)
	}

	// Signal completion
	rt.EventsEmit(a.ctx, "packageUpdateComplete", finalMessage)

	// If WailBrew was updated, emit event to show restart dialog
	if updatedPackages["wailbrew"] && a.ctx != nil {
		rt.EventsEmit(a.ctx, "wailbrewUpdated")
	}

	return finalMessage
}

func (a *App) GetBrewPackageInfoAsJson(packageName string) map[string]interface{} {
	// Try as formula first
	output, err := a.runBrewCommand("info", "--json=v2", packageName)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("Failed to get package info: %v", err),
		}
	}

	// Extract JSON portion from output (handling potential Homebrew warnings)
	outputStr := strings.TrimSpace(string(output))
	jsonOutput, warnings, err := extractJSONFromBrewOutput(outputStr)
	if err != nil {
		return map[string]interface{}{
			"error": fmt.Sprintf("Failed to extract JSON from package info: %v", err),
		}
	}

	// Log warnings if any were detected
	if warnings != "" {
		a.appendSessionLog(fmt.Sprintf("Homebrew warnings in package info for %s: %s", packageName, warnings))
	}

	var result struct {
		Formulae []map[string]interface{} `json:"formulae"`
		Casks    []map[string]interface{} `json:"casks"`
	}
	if err := json.Unmarshal([]byte(jsonOutput), &result); err != nil {
		return map[string]interface{}{
			"error": "Failed to parse package info",
		}
	}

	// Check formulae first
	if len(result.Formulae) > 0 {
		return result.Formulae[0]
	}

	// Check casks if not found in formulae
	if len(result.Casks) > 0 {
		caskInfo := result.Casks[0]

		// Normalize cask data to match formula structure for frontend compatibility
		// Convert conflicts_with.cask to conflicts_with array
		if conflictsObj, ok := caskInfo["conflicts_with"].(map[string]interface{}); ok {
			if caskConflicts, ok := conflictsObj["cask"].([]interface{}); ok {
				caskInfo["conflicts_with"] = caskConflicts
			} else {
				caskInfo["conflicts_with"] = []interface{}{}
			}
		}

		// Convert depends_on to dependencies array (simplified)
		// Casks don't really have formula dependencies like formulae do,
		// so we'll just provide an empty array or extract relevant info
		dependencies := []string{}
		if dependsOn, ok := caskInfo["depends_on"].(map[string]interface{}); ok {
			// Check for formula dependencies
			if formulaDeps, ok := dependsOn["formula"].([]interface{}); ok {
				for _, dep := range formulaDeps {
					if depStr, ok := dep.(string); ok {
						dependencies = append(dependencies, depStr)
					}
				}
			}
		}
		caskInfo["dependencies"] = dependencies

		return caskInfo
	}

	return map[string]interface{}{
		"error": "No package info found",
	}
}

func (a *App) GetBrewPackageInfo(packageName string) string {
	output, err := a.runBrewCommand("info", packageName)
	if err != nil {
		return fmt.Sprintf("Error: Failed to get package info: %v", err)
	}

	return string(output)
}

func (a *App) RunBrewDoctor() string {
	output, err := a.runBrewCommand("doctor")
	outputStr := string(output)

	// brew doctor exits with status 1 when there are warnings, which is normal behavior
	// Check if the output contains the standard brew doctor warning preamble
	// If it does, this is expected output and should be displayed as-is
	if err != nil {
		// Check if this is a real error (timeout, command not found, etc.) or just warnings
		// Real errors typically don't contain the standard brew doctor output
		if strings.Contains(outputStr, "Please note that these warnings are just used to help the Homebrew maintainers") ||
			strings.Contains(outputStr, "Warning:") ||
			strings.Contains(outputStr, "Your system is ready to brew") {
			// This is valid brew doctor output with warnings, return it as-is
			return outputStr
		}
		// This is a real error, show error message
		return fmt.Sprintf("Error running brew doctor: %v\n\nOutput:\n%s", err, outputStr)
	}
	return outputStr
}

// GetDeprecatedFormulae parses the brew doctor output and returns a list of deprecated formulae
func (a *App) GetDeprecatedFormulae(doctorOutput string) []string {
	var deprecated []string

	// Look for the deprecated formulae section
	// Pattern: "Warning: Some installed formulae are deprecated or disabled."
	// Followed by: "You should find replacements for the following formulae:"
	// Then a list of formulae, one per line, indented with spaces
	lines := strings.Split(doctorOutput, "\n")
	inDeprecatedSection := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Check if we're entering the deprecated section
		if strings.Contains(trimmed, "Some installed formulae are deprecated or disabled") ||
			strings.Contains(trimmed, "You should find replacements for the following formulae") {
			inDeprecatedSection = true
			continue
		}

		// If we're in the deprecated section and the line starts with spaces (indented),
		// it's likely a formula name
		if inDeprecatedSection {
			// Check if line is indented (starts with spaces) and contains a formula name
			if strings.HasPrefix(line, "  ") && trimmed != "" {
				// Extract formula name (remove leading spaces and any trailing content)
				formula := strings.TrimSpace(trimmed)
				// Remove any trailing colon or other punctuation
				formula = strings.TrimRight(formula, ":")
				if formula != "" {
					deprecated = append(deprecated, formula)
				}
			} else if trimmed == "" {
				// Empty line might be separator, continue
				continue
			} else if !strings.HasPrefix(line, " ") {
				// Line doesn't start with space, we've left the deprecated section
				break
			}
		}
	}

	return deprecated
}

// GetBrewCleanupDryRun runs brew cleanup --dry-run and returns the estimated space that can be freed
func (a *App) GetBrewCleanupDryRun() (string, error) {
	output, err := a.runBrewCommand("cleanup", "--dry-run")
	if err != nil {
		return "", fmt.Errorf("failed to run brew cleanup --dry-run: %w", err)
	}

	outputStr := string(output)

	// Parse the output to find the size estimate
	// Look for pattern like "This operation would free approximately 47.6MB of disk space."
	lines := strings.Split(outputStr, "\n")
	for _, line := range lines {
		if strings.Contains(line, "would free approximately") {
			// Extract the size from the line
			// Pattern: "This operation would free approximately 47.6MB of disk space."
			re := regexp.MustCompile(`approximately ([\d.]+(MB|GB|KB|B))`)
			matches := re.FindStringSubmatch(line)
			if len(matches) > 1 {
				return matches[1], nil
			}
		}
	}

	// If no size found, return empty string (no cleanup needed)
	return "0B", nil
}

func (a *App) RunBrewCleanup() string {
	output, err := a.runBrewCommand("cleanup")
	if err != nil {
		return fmt.Sprintf("Error running brew cleanup: %v\n\nOutput:\n%s", err, string(output))
	}
	return string(output)
}

// GetHomebrewVersion returns the installed Homebrew version
func (a *App) GetHomebrewVersion() (string, error) {
	output, err := a.runBrewCommand("--version")
	if err != nil {
		return "", fmt.Errorf("failed to get Homebrew version: %w", err)
	}

	outputStr := strings.TrimSpace(string(output))
	// Homebrew version output is typically: "Homebrew 4.x.x" or "Homebrew 4.x.x\nHomebrew/homebrew-core..."
	lines := strings.Split(outputStr, "\n")
	if len(lines) > 0 {
		// Extract version from first line (e.g., "Homebrew 4.2.1")
		parts := strings.Fields(lines[0])
		if len(parts) >= 2 {
			return parts[1], nil
		}
		return lines[0], nil
	}
	return outputStr, nil
}

// CheckHomebrewUpdate checks if Homebrew itself is up to date and returns status
// This function checks without actually updating - it reads the git repository status
func (a *App) CheckHomebrewUpdate() (map[string]interface{}, error) {
	// Get current version
	currentVersion, err := a.GetHomebrewVersion()
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"currentVersion": currentVersion,
		"isUpToDate":     true,
		"latestVersion":  currentVersion,
	}

	// Check Homebrew's git repository to see if there are updates
	// First, find the Homebrew installation directory
	brewDir := ""
	if runtime.GOOS == "darwin" {
		if runtime.GOARCH == "arm64" {
			brewDir = "/opt/homebrew"
		} else {
			brewDir = "/usr/local"
		}
	}

	if brewDir != "" {
		// Check if Homebrew directory exists and is a git repo
		gitDir := fmt.Sprintf("%s/.git", brewDir)
		if _, err := os.Stat(gitDir); err == nil {
			// Check git status to see if we're behind
			cmd := exec.Command("git", "-C", brewDir, "rev-list", "--count", "HEAD..origin/HEAD")
			cmd.Env = append(os.Environ(), a.getBrewEnv()...)
			behindOutput, _ := cmd.CombinedOutput()

			// If there are commits behind, an update is available
			behindCount := strings.TrimSpace(string(behindOutput))
			if behindCount != "" && behindCount != "0" {
				// Try to get the latest version tag or commit message
				cmd = exec.Command("git", "-C", brewDir, "describe", "--tags", "origin/HEAD")
				cmd.Env = append(os.Environ(), a.getBrewEnv()...)
				latestTag, _ := cmd.CombinedOutput()
				latestVersion := strings.TrimSpace(string(latestTag))

				if latestVersion != "" {
					result["isUpToDate"] = false
					result["latestVersion"] = latestVersion
				} else {
					// Fallback: just indicate update is available
					result["isUpToDate"] = false
					result["latestVersion"] = "latest"
				}
			}
		}
	}

	return result, nil
}

// UpdateHomebrew updates Homebrew itself (not packages, but Homebrew core)
func (a *App) UpdateHomebrew() string {
	// Emit initial progress
	rt.EventsEmit(a.ctx, "homebrewUpdateProgress", "🔄 Starting Homebrew update...")

	// Update Homebrew core repository
	cmd := exec.Command(a.brewPath, "update")
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	// Create pipes for real-time output
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := fmt.Sprintf("❌ Error creating output pipe: %v", err)
		rt.EventsEmit(a.ctx, "homebrewUpdateProgress", errorMsg)
		return errorMsg
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := fmt.Sprintf("❌ Error creating error pipe: %v", err)
		rt.EventsEmit(a.ctx, "homebrewUpdateProgress", errorMsg)
		return errorMsg
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := fmt.Sprintf("❌ Error starting Homebrew update: %v", err)
		rt.EventsEmit(a.ctx, "homebrewUpdateProgress", errorMsg)
		return errorMsg
	}

	// Read and emit output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "homebrewUpdateProgress", fmt.Sprintf("📦 %s", line))
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				rt.EventsEmit(a.ctx, "homebrewUpdateProgress", fmt.Sprintf("⚠️ %s", line))
			}
		}
	}()

	// Wait for command to complete
	err = cmd.Wait()

	var finalMessage string
	if err != nil {
		finalMessage = fmt.Sprintf("❌ Homebrew update failed: %v", err)
	} else {
		finalMessage = "✅ Homebrew update completed successfully!"
	}

	// Signal completion (only emit once via complete event, not progress)
	rt.EventsEmit(a.ctx, "homebrewUpdateComplete", finalMessage)

	return finalMessage
}

// GetAppVersion returns the application version
func (a *App) GetAppVersion() string {
	return Version
}

// GetBrewPath returns the current brew path
func (a *App) GetBrewPath() string {
	return a.brewPath
}

// SetBrewPath sets a custom brew path
func (a *App) SetBrewPath(path string) error {
	// Validate that the path exists and is executable
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("brew path does not exist: %s", path)
	}

	// Test if it's actually a brew executable by running --version
	cmd := exec.Command(path, "--version")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("invalid brew executable: %s", path)
	}

	a.brewPath = path
	return nil
}

// GetMirrorSource returns the current mirror source configuration
func (a *App) GetMirrorSource() map[string]string {
	return map[string]string{
		"gitRemote":    a.gitRemote,
		"bottleDomain": a.bottleDomain,
	}
}

// SetMirrorSource sets the Homebrew mirror source configuration
func (a *App) SetMirrorSource(gitRemote string, bottleDomain string) error {
	// Validate URLs if provided (empty string means use default)
	if gitRemote != "" {
		if !strings.HasPrefix(gitRemote, "http://") && !strings.HasPrefix(gitRemote, "https://") {
			return fmt.Errorf("invalid git remote URL: must start with http:// or https://")
		}
	}
	if bottleDomain != "" {
		if !strings.HasPrefix(bottleDomain, "http://") && !strings.HasPrefix(bottleDomain, "https://") {
			return fmt.Errorf("invalid bottle domain URL: must start with http:// or https://")
		}
	}

	a.gitRemote = gitRemote
	a.bottleDomain = bottleDomain
	return nil
}

// CheckForUpdates checks if a new version is available on GitHub
func (a *App) CheckForUpdates() (*UpdateInfo, error) {
	currentVersion := Version

	// Fetch latest release from GitHub API
	resp, err := http.Get("https://api.github.com/repos/wickenico/WailBrew/releases/latest")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch release info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var release GitHubRelease
	if err := json.Unmarshal(body, &release); err != nil {
		return nil, fmt.Errorf("failed to parse release info: %w", err)
	}

	// Find the macOS app asset
	var downloadURL string
	var fileSize int64
	for _, asset := range release.Assets {
		if strings.Contains(asset.Name, "wailbrew") && strings.Contains(asset.Name, ".zip") {
			downloadURL = asset.BrowserDownloadURL
			fileSize = asset.Size
			break
		}
	}

	// Compare versions (simple string comparison for now)
	latestVersion := strings.TrimPrefix(release.TagName, "v")
	currentVersionClean := strings.TrimPrefix(currentVersion, "v")

	updateInfo := &UpdateInfo{
		Available:      latestVersion != currentVersionClean,
		CurrentVersion: currentVersion,
		LatestVersion:  latestVersion,
		ReleaseNotes:   release.Body,
		DownloadURL:    downloadURL,
		FileSize:       fileSize,
		PublishedAt:    release.PublishedAt,
	}

	return updateInfo, nil
}

// DownloadAndInstallUpdate downloads and installs the update
func (a *App) DownloadAndInstallUpdate(downloadURL string) error {
	// Create temporary directory
	tempDir := "/tmp/wailbrew_update"
	os.RemoveAll(tempDir)
	os.MkdirAll(tempDir, 0755)

	// Download the update
	resp, err := http.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("failed to download update: %w", err)
	}
	defer resp.Body.Close()

	// Save to temporary file
	zipPath := fmt.Sprintf("%s/wailbrew_update.zip", tempDir)
	zipFile, err := os.Create(zipPath)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	defer zipFile.Close()

	_, err = io.Copy(zipFile, resp.Body)
	if err != nil {
		return fmt.Errorf("failed to save update: %w", err)
	}

	// Unzip the update
	cmd := exec.Command("unzip", "-q", zipPath, "-d", tempDir)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to unzip update: %w", err)
	}

	// Find the app bundle
	appPath := fmt.Sprintf("%s/WailBrew.app", tempDir)
	if _, err := os.Stat(appPath); os.IsNotExist(err) {
		return fmt.Errorf("app bundle not found in update")
	}

	// Get current app location
	currentAppPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get current app path: %w", err)
	}

	// Navigate to the .app bundle root
	for strings.Contains(currentAppPath, ".app/") {
		currentAppPath = strings.Split(currentAppPath, ".app/")[0] + ".app"
		break
	}

	// Create backup
	backupPath := currentAppPath + ".backup"
	os.RemoveAll(backupPath)

	// Replace the app (requires admin privileges)
	script := fmt.Sprintf(`
		osascript -e 'do shell script "rm -rf \\"%s\\" && mv \\"%s\\" \\"%s\\" && mv \\"%s\\" \\"%s\\"" with administrator privileges'
	`, backupPath, currentAppPath, backupPath, appPath, currentAppPath)

	cmd = exec.Command("sh", "-c", script)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to replace app: %w", err)
	}

	// Clean up
	os.RemoveAll(tempDir)

	// Don't auto-restart - let the user restart manually via UI
	// The update has been successfully installed

	return nil
}

// RestartApp restarts the WailBrew application
func (a *App) RestartApp() error {
	// Get current app location
	currentAppPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get current app path: %w", err)
	}

	// Navigate to the .app bundle root
	for strings.Contains(currentAppPath, ".app/") {
		currentAppPath = strings.Split(currentAppPath, ".app/")[0] + ".app"
		break
	}

	// Launch the new version and quit
	go func() {
		// Wait a bit before restarting to ensure clean shutdown
		time.Sleep(500 * time.Millisecond)

		// Use 'open -n' to force a new instance and ensure it launches even if the app is already running
		cmd := exec.Command("open", "-n", currentAppPath)
		err := cmd.Start()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to restart app: %v\n", err)
			// Try alternative method using direct execution
			cmd = exec.Command("open", currentAppPath)
			if err := cmd.Start(); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to restart app (alternative method): %v\n", err)
			}
		}

		// Give macOS time to process the launch before quitting
		time.Sleep(1 * time.Second)
		rt.Quit(a.ctx)
	}()

	return nil
}

// ExportBrewfile exports the current Homebrew installation to a Brewfile
func (a *App) ExportBrewfile(filePath string) error {
	// Run brew bundle dump to the specified file path
	cmd := exec.Command(a.brewPath, "bundle", "dump", "--file="+filePath, "--force")
	cmd.Env = append(os.Environ(), a.getBrewEnv()...)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("brew bundle dump failed: %v\nOutput: %s", err, string(output))
	}

	return nil
}
