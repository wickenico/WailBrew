# Contributing to WailBrew

Thank you for your interest in contributing to WailBrew! This guide will help you get started with development.

## 🚀 Development Setup

### Prerequisites

If you want to build WailBrew from source, you'll need:

- **macOS** with Apple Silicon (not tested on Intel)

- **Homebrew** - Install with:
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```

- **Go** (version 1.27 or higher, see `go.mod`) - Install with Homebrew:
  ```bash
  brew install go
  ```

- **Node.js** (version 26 or higher, see `.nvmrc`) - for frontend development. Install with Homebrew:
  ```bash
  brew install node
  ```

- **pnpm** (package manager) - Install with npm:
  ```bash
  npm install -g pnpm
  ```
  The exact version is pinned via `packageManager` in `frontend/package.json`; pnpm switches to it automatically.

- **Wails v3 CLI** (`wails3`) - Install the version pinned in `go.mod` with:
  ```bash
  make update-cli
  ```
  Make sure `~/go/bin` is in your PATH. `wails3 doctor` checks your setup.

### Getting Started

```bash
# Clone the repository
git clone https://github.com/wickenico/WailBrew.git
cd WailBrew

# Install Go dependencies
go mod download

# Install frontend dependencies
cd frontend && pnpm install

# Start the app in development mode
cd .. && make dev
# or alternatively: wails3 dev
```

### Production Build

```bash
make build            # build/bin/WailBrew.app for the current architecture
make build-universal  # universal (arm64 + amd64) app bundle
```

Builds run through the Wails v3 Taskfiles (`Taskfile.yml`, `build/Taskfile.yml`, `build/darwin/Taskfile.yml`). They read the version from `frontend/package.json` and embed it in the binary, so the About dialog shows the correct version. Project metadata lives in `build/config.yml`; `make bump` / `make bump-minor` keep it and the darwin plists in sync with `frontend/package.json`.

### Available Make Commands

```bash
make dev       # Start development server
make bindings  # Regenerate frontend/bindings after changing exported App methods
make clean     # Remove build/bin
make install   # Build and install to /Applications
```

### Releasing (maintainers)

Releases are built, signed and published from a Mac with the Developer ID certificate, a `wailbrew-notary` notarytool profile and an authenticated `gh`:

```bash
make bump-minor        # or: make bump — then commit and push to main
make release
```

Releases are always universal (Apple Silicon and Intel); `scripts/release.sh` refuses to publish a binary that is missing `arm64` or `x86_64`.

`make release` first runs `make release-check` (on `main`, clean and pushed, version matches `frontend/package.json`, tag and release don't exist yet, signing identity present), then builds, signs, notarizes and zips the app, shows the generated release notes (edit them with `e`, or pass `NOTES_FILE=notes.md`), and after confirmation pushes the `v<version>` tag and creates the GitHub release with the zip. Homebrew's BrewTestBot then bumps the official `wailbrew` cask. `make release-notes` previews the notes.

## 🧪 Testing

Frontend utility functions are tested with [Vitest](https://vitest.dev/), which shares the same Vite configuration used for development builds.

```bash
# Run all tests once
cd frontend && pnpm test

# Run in watch mode during development
cd frontend && pnpm test:watch
```

Tests live alongside the code they cover under `__tests__/` directories:

```
frontend/src/utils/
├── parseInfoLog.ts
└── __tests__/
    └── parseInfoLog.test.ts
```

Pure utility functions (no Wails bindings, no DOM) use `environment: 'node'` and need no extra setup.

## 🛠️ Development

### Live Development

To run in live development mode, run `make dev` in the project directory. This runs a Vite development server with fast hot reload for frontend changes and rebuilds the app when Go files change.

The frontend talks to Go through generated TypeScript bindings in `frontend/bindings` (committed, checked in CI) and the [`@wailsio/runtime`](https://www.npmjs.com/package/@wailsio/runtime) package for events, window and browser helpers. After adding or changing an exported method on `App`, run `make bindings`. Subscribe to backend events with `onEvent` from `frontend/src/utils/events.ts`.

### Project Structure

- `/frontend` - React + TypeScript frontend
  - `/src/components` - React components
  - `/src/i18n` - Internationalization files
  - `/bindings` - Generated Go bindings (do not edit)
- `/build` - Wails v3 build config, Taskfiles and macOS plists/icons
- `/main.go` - Go backend entry point
- `/app.go` - Main application logic

## 🤝 How to Contribute

### Code Contributions

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Translation Contributions

WailBrew supports multiple languages. To add a new language:

1. Create a new JSON file in `/frontend/src/i18n/locales/` (e.g., `es.json` for Spanish)
2. Copy the structure from `en.json` and translate all strings
3. Update `/frontend/src/i18n/index.ts` to include your language
4. Add the language flag to the Sidebar component
5. Submit a Pull Request

### Reporting Bugs

If you find a bug, please create an issue on GitHub with:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- System information (macOS version, WailBrew version)

### Suggesting Features

Feature requests are welcome! Please create an issue describing:
- The feature you'd like to see
- Why it would be useful
- How it might work

## 📋 Code Guidelines

- Write clear, descriptive commit messages
- Follow existing code style and conventions
- Test your changes thoroughly
- Update documentation as needed

## 📝 License

By contributing to WailBrew, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You

Every contribution, no matter how small, helps make WailBrew better for everyone!

