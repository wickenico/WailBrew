package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Restore last-known window size from config (NewApp already loaded it).
	// Width/Height are applied here so the window opens at the correct size on
	// the very first frame, avoiding a visible resize after open. Position is
	// restored later via runtime.WindowSetPosition in startup() because Wails v2
	// has no initial-position option.
	width, height := 1024, 768
	if app.config.WindowWidth >= 600 && app.config.WindowHeight >= 450 {
		width = app.config.WindowWidth
		height = app.config.WindowHeight
	}
	startState := options.Normal
	if app.config.WindowMaximized {
		startState = options.Maximised
	}

	// Create application with options
	err := wails.Run(&options.App{
		Title:            "WailBrew",
		Width:            width,
		Height:           height,
		MinWidth:         600,
		MinHeight:        450,
		WindowStartState: startState,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Menu:             app.menu(),
		Bind: []interface{}{
			app,
		},
		Mac: &mac.Options{
			TitleBar: &mac.TitleBar{
				TitlebarAppearsTransparent: false,
				HideTitle:                  false,
				HideTitleBar:               false,
				FullSizeContent:            false,
				UseToolbar:                 false,
				HideToolbarSeparator:       false,
			},
			Appearance:           mac.DefaultAppearance,
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
