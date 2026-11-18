package main

import (
	"embed"
	"log"
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	service := NewApp()

	width, height := 1024, 768
	if service.config.WindowWidth >= 600 && service.config.WindowHeight >= 450 {
		width = service.config.WindowWidth
		height = service.config.WindowHeight
	}

	startState := application.WindowStateNormal
	if service.config.WindowMaximized {
		startState = application.WindowStateMaximised
	}

	app := application.New(application.Options{
		Name: "WailBrew",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})
	service.setApplication(app)
	app.RegisterService(application.NewService(service))

	windowOptions := application.WebviewWindowOptions{
		Name:               "main",
		Title:              "WailBrew",
		Width:              width,
		Height:             height,
		MinWidth:           600,
		MinHeight:          450,
		StartState:         startState,
		Frameless:          runtime.GOOS == "linux",
		BackgroundColour:   application.NewRGBA(27, 38, 54, 1),
		UseApplicationMenu: runtime.GOOS != "linux",
		URL:                "/",
		Mac: application.MacWindow{
			TitleBar: application.MacTitleBar{
				AppearsTransparent:   true,
				HideTitle:            true,
				FullSizeContent:      true,
				UseToolbar:           false,
				HideToolbarSeparator: false,
			},
			Appearance: application.DefaultAppearance,
		},
	}
	if (service.config.WindowX != 0 || service.config.WindowY != 0) && isOnScreen(service.config.WindowX, service.config.WindowY) {
		windowOptions.InitialPosition = application.WindowXY
		windowOptions.X = service.config.WindowX
		windowOptions.Y = service.config.WindowY
	}

	mainWindow := app.Window.NewWithOptions(windowOptions)
	mainWindow.RegisterHook(events.Common.WindowClosing, func(*application.WindowEvent) {
		service.persistWindowGeometry()
	})
	service.setMainWindow(mainWindow)
	if runtime.GOOS != "linux" {
		app.Menu.Set(service.menu())
	}

	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
