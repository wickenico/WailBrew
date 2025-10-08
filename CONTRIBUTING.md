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

- **Go** (version 1.25 or higher) - Install with Homebrew:
  ```bash
  brew install go
  ```

- **Node.js** (for frontend development) - Install with Homebrew:
  ```bash
  brew install node
  ```

- **pnpm** (package manager) - Install with npm:
  ```bash
  npm install -g pnpm
  ```

- **Wails CLI** - Install with:
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```
  Make sure `~/go/bin` is in your PATH.

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
# or alternatively: wails dev
```

### Production Build

```bash
wails build

# The built app will be in the build/bin/ directory
```

**Note**: Use `make` for production builds as it automatically reads the version from `frontend/package.json` and embeds it in the binary. This ensures the About dialog displays the correct version in production.

### Available Make Commands

```bash
make dev     # Start development server
make clean   # Clean build directory
make install # Build and install to /Applications
```

## 🛠️ Development

### Live Development

To run in live development mode, run `wails dev` in the project directory. This will run a Vite development server that will provide very fast hot reload of your frontend changes. If you want to develop in a browser and have access to your Go methods, there is also a dev server that runs on http://localhost:34115. Connect to this in your browser, and you can call your Go code from devtools.

### Project Structure

- `/frontend` - React + TypeScript frontend
  - `/src/components` - React components
  - `/src/i18n` - Internationalization files
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

