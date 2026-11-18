package ui

import (
	"fmt"
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// AppInterface defines the application operations used by the native menu.
type AppInterface interface {
	OpenURL(url string)
	GetTranslation(key string, params map[string]string) string
	ExportBrewfile(filePath string) error
	ImportBrewfile(filePath string, cleanup bool) error
	OpenConfigFile() error
	ClearConfigFile() error
}

// Build creates the application menu using the v3 menu and dialog APIs.
func Build(wailsApp *application.App, app AppInterface) *application.Menu {
	menu := wailsApp.Menu.New()
	getT := func(key string) string { return app.GetTranslation(key, nil) }
	emit := func(name string, data ...any) {
		wailsApp.Event.Emit(name, data...)
	}
	add := func(parent *application.Menu, label, accelerator string, callback func()) {
		item := parent.Add(label).OnClick(func(_ *application.Context) { callback() })
		if accelerator != "" {
			item.SetAccelerator(accelerator)
		}
	}
	showError := func(title, message string) {
		wailsApp.Dialog.Error().SetTitle(title).SetMessage(message).Show()
	}
	showInfo := func(title, message string) {
		wailsApp.Dialog.Info().SetTitle(title).SetMessage(message).Show()
	}

	appMenu := menu.AddSubmenu("WailBrew")
	add(appMenu, getT("menu.app.about"), "", func() { emit("showAbout") })
	appMenu.AddSeparator()
	add(appMenu, getT("menu.view.settings"), "CmdOrCtrl+,", func() { emit("setView", "settings") })
	add(appMenu, getT("menu.view.shortcuts"), "CmdOrCtrl+Shift+S", func() { emit("showShortcuts") })
	appMenu.AddSeparator()
	add(appMenu, getT("menu.app.checkUpdates"), "", func() { emit("checkForUpdates") })
	appMenu.AddSeparator()
	add(appMenu, getT("menu.app.visitWebsite"), "", func() { app.OpenURL("https://wailbrew.app") })
	add(appMenu, getT("menu.app.visitGitHub"), "", func() { app.OpenURL("https://github.com/wickenico/WailBrew") })
	add(appMenu, getT("menu.app.reportBug"), "", func() {
		app.OpenURL("https://github.com/wickenico/WailBrew/issues/new?template=bug_report.yml")
	})
	add(appMenu, getT("menu.app.visitSubreddit"), "", func() { app.OpenURL("https://www.reddit.com/r/WailBrew/") })
	add(appMenu, getT("menu.app.sponsorProject"), "", func() { app.OpenURL("https://github.com/sponsors/wickenico") })
	appMenu.AddSeparator()
	add(appMenu, getT("menu.app.quit"), "CmdOrCtrl+Q", wailsApp.Quit)

	viewMenu := menu.AddSubmenu(getT("menu.view.title"))
	for _, item := range []struct {
		key, accelerator, view string
	}{
		{"menu.view.installed", "CmdOrCtrl+1", "installed"},
		{"menu.view.casks", "CmdOrCtrl+2", "casks"},
		{"menu.view.outdated", "CmdOrCtrl+3", "updatable"},
		{"menu.view.leaves", "CmdOrCtrl+4", "leaves"},
		{"menu.view.repositories", "CmdOrCtrl+5", "repositories"},
	} {
		item := item
		add(viewMenu, getT(item.key), item.accelerator, func() { emit("setView", item.view) })
	}
	viewMenu.AddSeparator()
	for _, item := range []struct {
		key, accelerator, view string
	}{
		{"menu.view.allFormulae", "CmdOrCtrl+6", "all"},
		{"menu.view.allCasks", "CmdOrCtrl+7", "allCasks"},
		{"menu.view.adoptable", "CmdOrCtrl+Shift+A", "adoptable"},
	} {
		item := item
		add(viewMenu, getT(item.key), item.accelerator, func() { emit("setView", item.view) })
	}
	viewMenu.AddSeparator()
	for _, item := range []struct {
		key, accelerator, view string
	}{
		{"menu.view.homebrew", "CmdOrCtrl+8", "homebrew"},
		{"menu.view.services", "CmdOrCtrl+P", "services"},
		{"menu.view.doctor", "CmdOrCtrl+9", "doctor"},
		{"menu.view.security", "CmdOrCtrl+Shift+V", "security"},
		{"menu.view.cleanup", "CmdOrCtrl+0", "cleanup"},
		{"menu.view.snapshots", "CmdOrCtrl+B", "snapshots"},
		{"menu.view.dashboard", "CmdOrCtrl+D", "dashboard"},
	} {
		item := item
		add(viewMenu, getT(item.key), item.accelerator, func() { emit("setView", item.view) })
	}

	toolsMenu := menu.AddSubmenu(getT("menu.tools.title"))
	add(toolsMenu, getT("menu.tools.refreshPackages"), "CmdOrCtrl+Shift+R", func() { emit("refreshPackagesData") })
	toolsMenu.AddSeparator()
	add(toolsMenu, getT("menu.tools.exportBrewfile"), "CmdOrCtrl+E", func() {
		path, err := wailsApp.Dialog.SaveFileWithOptions(&application.SaveFileDialogOptions{
			Title:                getT("menu.tools.exportBrewfile"),
			Filename:             "Brewfile",
			CanCreateDirectories: true,
		}).PromptForSingleSelection()
		if err != nil || path == "" {
			return
		}
		if err := app.ExportBrewfile(path); err != nil {
			showError(getT("menu.tools.exportFailed"), fmt.Sprintf("Failed to export Brewfile: %v", err))
			return
		}
		showInfo(getT("menu.tools.exportSuccess"), fmt.Sprintf(getT("menu.tools.exportMessage"), path))
	})
	add(toolsMenu, getT("menu.tools.importBrewfile"), "CmdOrCtrl+Shift+I", func() {
		path, err := wailsApp.Dialog.OpenFileWithOptions(&application.OpenFileDialogOptions{
			Title:                getT("menu.tools.importBrewfile"),
			CanChooseDirectories: false,
			CanChooseFiles:       true,
		}).PromptForSingleSelection()
		if err != nil || path == "" {
			return
		}
		promptImportCleanup(wailsApp, app, getT, path, showError, showInfo)
	})
	add(toolsMenu, getT("menu.tools.openConfigFile"), "", func() {
		if err := app.OpenConfigFile(); err != nil {
			showError(getT("menu.tools.openConfigFailed"), fmt.Sprintf("Failed to open config file: %v", err))
		}
	})
	add(toolsMenu, getT("menu.tools.clearConfigFile"), "", func() {
		promptClearConfig(wailsApp, app, getT, showError, showInfo)
	})
	toolsMenu.AddSeparator()
	add(toolsMenu, getT("menu.tools.viewSessionLogs"), "", func() { emit("showSessionLogs") })

	if runtime.GOOS == "darwin" {
		menu.AddRole(application.EditMenu)
		menu.AddRole(application.WindowMenu)
	}

	helpMenu := menu.AddSubmenu(getT("menu.help.title"))
	add(helpMenu, getT("menu.help.wailbrewHelp"), "", func() {
		showInfo(getT("menu.help.helpTitle"), getT("menu.help.helpMessage"))
	})

	return menu
}

func promptImportCleanup(
	wailsApp *application.App,
	app AppInterface,
	getT func(string) string,
	path string,
	showError func(string, string),
	showInfo func(string, string),
) {
	dialog := wailsApp.Dialog.Question().SetTitle(getT("menu.tools.importCleanupConfirmTitle")).
		SetMessage(getT("menu.tools.importCleanupConfirmMessage"))
	yes := dialog.AddButton(getT("menu.tools.importCleanupYes"))
	yes.OnClick(func() { importBrewfile(app, path, true, getT, showError, showInfo) })
	keep := dialog.AddButton(getT("menu.tools.importKeepExtra"))
	keep.OnClick(func() { importBrewfile(app, path, false, getT, showError, showInfo) })
	dialog.SetDefaultButton(keep)
	cancel := dialog.AddButton(getT("buttons.cancel"))
	dialog.SetCancelButton(cancel)
	dialog.Show()
}

func importBrewfile(
	app AppInterface,
	path string,
	cleanup bool,
	getT func(string) string,
	showError func(string, string),
	showInfo func(string, string),
) {
	if err := app.ImportBrewfile(path, cleanup); err != nil {
		showError(getT("menu.tools.importFailed"), fmt.Sprintf("Failed to import Brewfile: %v", err))
		return
	}
	showInfo(getT("menu.tools.importSuccess"), fmt.Sprintf(getT("menu.tools.importMessage"), path))
}

func promptClearConfig(
	wailsApp *application.App,
	app AppInterface,
	getT func(string) string,
	showError func(string, string),
	showInfo func(string, string),
) {
	dialog := wailsApp.Dialog.Question().SetTitle(getT("menu.tools.clearConfigConfirmTitle")).
		SetMessage(getT("menu.tools.clearConfigConfirmMessage"))
	yes := dialog.AddButton(getT("buttons.yes"))
	yes.OnClick(func() {
		if err := app.ClearConfigFile(); err != nil {
			showError(getT("menu.tools.clearConfigFailed"), fmt.Sprintf("Failed to clear config file: %v", err))
			return
		}
		showInfo(getT("menu.tools.clearConfigSuccess"), getT("menu.tools.clearConfigSuccessMessage"))
	})
	cancel := dialog.AddButton(getT("buttons.cancel"))
	dialog.SetDefaultButton(cancel)
	dialog.SetCancelButton(cancel)
	dialog.Show()
}
