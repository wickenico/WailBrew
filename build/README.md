# Build Directory

Build configuration and assets for Wails v3.

* `bin/` - Build output (`WailBrew.app`, ignored by git)
* `config.yml` - Project metadata and `wails3 dev` settings (replaces the v2 `wails.json`)
* `Taskfile.yml` - Shared tasks: frontend build, binding and icon generation
* `appicon.png` - Source image for the app icon
* `darwin/` - macOS specific files

The root `Taskfile.yml` wires these together; the `Makefile` targets (`make build`, `make dev`, ...) call into it.

## Mac

- `Taskfile.yml` - Builds the binary (with `-X main.Version`), the universal binary and the `.app` bundle.
- `Info.plist` - The plist used for production bundles (`make build`).
- `Info.dev.plist` - Same as `Info.plist` but used by `make dev`.
- `icons.icns` - Generated from `../appicon.png` during the build.

`wails3 task common:update:build-assets` regenerates the plists from `config.yml` and overwrites local changes.
