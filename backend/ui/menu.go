package ui

import (
	"context"
	"fmt"
	"runtime"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	rt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// AppInterface defines the interface needed for menu building
type AppInterface interface {
	GetContext() context.Context
	OpenURL(url string)
	GetTranslation(key string, params map[string]string) string
	ExportBrewfile(filePath string) error
	OpenConfigFile() error
}

// Build creates the application menu
func Build(app AppInterface) *menu.Menu {
	getT := func(key string) string {
		return app.GetTranslation(key, nil)
	}

	// Helper to get context dynamically when callback executes
	getCtx := func() context.Context {
		return app.GetContext()
	}

	AppMenu := menu.NewMenu()

	// App Menu (macOS-like)
	AppSubmenu := AppMenu.AddSubmenu("WailBrew")
	AppSubmenu.AddText(getT("menu.app.about"), nil, func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "showAbout")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(getT("menu.view.settings"), keys.CmdOrCtrl(","), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "setView", "settings")
	})
	AppSubmenu.AddText(getT("menu.view.commandPalette"), keys.CmdOrCtrl("k"), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "showCommandPalette")
	})
	AppSubmenu.AddText(getT("menu.view.shortcuts"), keys.Combo("s", keys.CmdOrCtrlKey, keys.ShiftKey), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "showShortcuts")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(getT("menu.app.checkUpdates"), nil, func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "checkForUpdates")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(getT("menu.app.visitWebsite"), nil, func(cd *menu.CallbackData) {
		app.OpenURL("https://wailbrew.app")
	})
	AppSubmenu.AddText(getT("menu.app.visitGitHub"), nil, func(cd *menu.CallbackData) {
		app.OpenURL("https://github.com/wickenico/WailBrew")
	})
	AppSubmenu.AddText(getT("menu.app.reportBug"), nil, func(cd *menu.CallbackData) {
		app.OpenURL("https://github.com/wickenico/WailBrew/issues")
	})
	AppSubmenu.AddText(getT("menu.app.visitSubreddit"), nil, func(cd *menu.CallbackData) {
		app.OpenURL("https://www.reddit.com/r/WailBrew/")
	})
	AppSubmenu.AddText(getT("menu.app.sponsorProject"), nil, func(cd *menu.CallbackData) {
		app.OpenURL("https://github.com/sponsors/wickenico")
	})
	AppSubmenu.AddSeparator()
	AppSubmenu.AddText(getT("menu.app.quit"), keys.CmdOrCtrl("q"), func(cd *menu.CallbackData) {
		rt.Quit(getCtx())
	})

	ViewMenu := AppMenu.AddSubmenu(getT("menu.view.title"))
	ViewMenu.AddText(getT("menu.view.installed"), keys.CmdOrCtrl("1"), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "setView", "installed")
	})
	ViewMenu.AddText(getT("menu.view.casks"), keys.CmdOrCtrl("2"), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "setView", "casks")
	})
	ViewMenu.AddText(getT("menu.view.outdated"), keys.CmdOrCtrl("3"), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "setView", "updatable")
	})
	ViewMenu.AddText(getT("menu.view.leaves"), keys.CmdOrCtrl("4"), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "setView", "leaves")
	})
	ViewMenu.AddText(getT("menu.view.repositories"), keys.CmdOrCtrl("5"), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "setView", "repositories")
	})
	ViewMenu.AddSeparator()
	ViewMenu.AddText(getT("menu.view.allFormulae"), keys.CmdOrCtrl("6"), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "setView", "all")
	})
	ViewMenu.AddText(getT("menu.view.allCasks"), keys.CmdOrCtrl("7"), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "setView", "allCasks")
	})
	ViewMenu.AddSeparator()
	ViewMenu.AddText(getT("menu.view.homebrew"), keys.CmdOrCtrl("8"), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "setView", "homebrew")
	})
	ViewMenu.AddText(getT("menu.view.doctor"), keys.CmdOrCtrl("9"), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "setView", "doctor")
	})
	ViewMenu.AddText(getT("menu.view.cleanup"), keys.CmdOrCtrl("0"), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "setView", "cleanup")
	})

	// Tools Menu
	ToolsMenu := AppMenu.AddSubmenu(getT("menu.tools.title"))
	ToolsMenu.AddText(getT("menu.tools.refreshPackages"), keys.Combo("r", keys.CmdOrCtrlKey, keys.ShiftKey), func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "refreshPackagesData")
	})
	ToolsMenu.AddSeparator()
	ToolsMenu.AddText(getT("menu.tools.exportBrewfile"), keys.CmdOrCtrl("e"), func(cd *menu.CallbackData) {
		ctx := getCtx()
		// Open file picker dialog to save Brewfile
		saveDialog, err := rt.SaveFileDialog(ctx, rt.SaveDialogOptions{
			DefaultFilename:      "Brewfile",
			Title:                getT("menu.tools.exportBrewfile"),
			CanCreateDirectories: true,
		})

		if err == nil && saveDialog != "" {
			err := app.ExportBrewfile(saveDialog)
			if err != nil {
				rt.MessageDialog(ctx, rt.MessageDialogOptions{
					Type:    rt.ErrorDialog,
					Title:   getT("menu.tools.exportFailed"),
					Message: fmt.Sprintf("Failed to export Brewfile: %v", err),
				})
			} else {
				rt.MessageDialog(ctx, rt.MessageDialogOptions{
					Type:    rt.InfoDialog,
					Title:   getT("menu.tools.exportSuccess"),
					Message: fmt.Sprintf(getT("menu.tools.exportMessage"), saveDialog),
				})
			}
		}
	})
	ToolsMenu.AddText(getT("menu.tools.openConfigFile"), nil, func(cd *menu.CallbackData) {
		ctx := getCtx()
		err := app.OpenConfigFile()
		if err != nil {
			rt.MessageDialog(ctx, rt.MessageDialogOptions{
				Type:    rt.ErrorDialog,
				Title:   getT("menu.tools.openConfigFailed"),
				Message: fmt.Sprintf("Failed to open config file: %v", err),
			})
		}
	})
	ToolsMenu.AddSeparator()
	ToolsMenu.AddText(getT("menu.tools.viewSessionLogs"), nil, func(cd *menu.CallbackData) {
		rt.EventsEmit(getCtx(), "showSessionLogs")
	})

	// Edit-Menu (optional)
	if runtime.GOOS == "darwin" {
		AppMenu.Append(menu.EditMenu())
		AppMenu.Append(menu.WindowMenu())
	}

	HelpMenu := AppMenu.AddSubmenu(getT("menu.help.title"))
	HelpMenu.AddText(getT("menu.help.wailbrewHelp"), nil, func(cd *menu.CallbackData) {
		ctx := getCtx()
		rt.MessageDialog(ctx, rt.MessageDialogOptions{
			Type:    rt.InfoDialog,
			Title:   getT("menu.help.helpTitle"),
			Message: getT("menu.help.helpMessage"),
		})
	})

	return AppMenu
}
