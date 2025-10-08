# WailBrew - Homebrew GUI Manager

[![Latest Release](https://img.shields.io/github/v/release/wickenico/WailBrew)](https://github.com/wickenico/WailBrew/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/wickenico/WailBrew/total)](https://github.com/wickenico/WailBrew/releases)

## 🍺 About WailBrew

A modern, user-friendly graphical interface for Homebrew package management on macOS. WailBrew simplifies managing your Homebrew formulas with an intuitive desktop application.

Requests, Questions, Troubleshooting? => [r/WailBrew](https://www.reddit.com/r/WailBrew)

## 📥 Installation

📦 **Installation via Homebrew (recommended):**

```bash
brew tap wickenico/wailbrew
brew install --cask wailbrew
```

**[Download Latest Version](https://github.com/wickenico/WailBrew/releases/latest)** 

## 📸 Screenshots

![WailBrew Screenshot](images/Screenshot.png)

## 🌍 Localizations

WailBrew supports multiple languages! As of now, the following languages are supported:

- 🇺🇸 English  
- 🇩🇪 German  
- 🇫🇷 French  
- 🇹🇷 Turkish  
- 🇨🇳 Chinese (Simplified)  

If you wish to contribute by translating WailBrew to your language, feel free to [open a Pull Request](https://github.com/wickenico/WailBrew/pulls) or [create an Issue](https://github.com/wickenico/WailBrew/issues).

## 📰 Mentioned

- <a href="https://vvmac.com/wordpress_b/wailbrew-pare-homebrew-dune-interface-graphique/" target="_blank" rel="noopener noreferrer">VVMac</a>
- <a href="https://softwareontheweb.com/product/wailbrew" target="_blank" rel="noopener noreferrer">Software on the web</a>
- <a href="https://madewithreactjs.com/wailbrew" target="_blank" rel="noopener noreferrer">Made with ReactJS</a>
- <a href="https://tom-doerr.github.io/repo_posts/" target="_blank" rel="noopener noreferrer">Tom Doerr Repository Showcase</a>
- <a href="https://alternativeto.net/software/wailbrew/about/" target="_blank" rel="noopener noreferrer">AlternativeTo</a>

## ✨ Key Features
### 📦 Package Management
- **View Installed Packages**: Table view of all installed formulas and casks
- **Package Information**: Detailed info including description, homepage, dependencies, and conflicts
- **Package Removal**: Safe uninstallation with confirmations
- **Search Function**: Quick search through packages

### 🔄 Update Management
- **Outdated Package Detection**: Automatic detection of available updates
- **Individual Updates**: Update specific packages
- **Update Logs**: Complete operation logs
- **Version Comparison**: Current vs. latest version display

### 🩺 System Diagnostics
- **Homebrew Doctor**: Integrated `brew doctor` diagnostics
- **Problem Detection**: Identifies common Homebrew issues
- **Detailed Logs**: Comprehensive troubleshooting output

### 🎯 User Experience
- **Modern UI**: Clean, responsive interface
- **Real-time Updates**: Live package list refreshing
- **Intuitive Navigation**: Simple sidebar navigation
- **Confirmation Dialogs**: Safe confirmation for critical actions

## 🚀 Installation & Setup
### Prerequisites
#### For Users
- macOS with Apple Silicon (not tested on Intel)
- Homebrew must be installed

#### For Developers
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

### Development Setup
``` bash
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
``` bash
  wails build

# The built app will be in the build/bin/ directory
```

**Note**: Use `make` for production builds as it automatically reads the version from `frontend/package.json` and embeds it in the binary. This ensures the About dialog displays the correct version in production.

### Additional Make Commands
``` bash
make dev     # Start development server
make clean   # Clean build directory
make install # Build and install to /Applications
```

## 🛠️ Development

### Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

### Live Development

To run in live development mode, run `wails dev` in the project directory. This will run a Vite development
server that will provide very fast hot reload of your frontend changes. If you want to develop in a browser
and have access to your Go methods, there is also a dev server that runs on http://localhost:34115. Connect
to this in your browser, and you can call your Go code from devtools.

## 📝 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
## 🐛 Troubleshooting
### Common Issues
- **Homebrew not found**: Ensure Homebrew is correctly installed
- **Permission errors**: May need to run the app with appropriate permissions
- **Slow performance**: Close other resource-intensive applications

### Support
- Create an issue on GitHub for bugs or feature requests
- Check existing issues before creating new ones

## 🏆 Acknowledgments
- Wails community for the framework: https://wails.io
- Cakebrew as inspiration: https://www.cakebrew.com/

**WailBrew** makes Homebrew management simple and accessible for all macOS users. Try it out and streamline your package management workflow!
