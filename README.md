# WailBrew - Homebrew GUI Manager
A modern, user-friendly graphical interface for Homebrew package management on macOS. WailBrew simplifies managing your Homebrew formulas with an intuitive desktop application.
## 🍺 About WailBrew
WailBrew is a desktop GUI manager for Homebrew built with Wails, Go, and React. The application streamlines Homebrew package management through an intuitive user interface, providing all essential features for daily package administration.

## 📸 Screenshots

![WailBrew Screenshot](images/screenshot.png)
## ✨ Key Features
### 📦 Package Management
- **View Installed Packages**: Clear table view of all installed Homebrew formulas
- **Package Information**: Detailed information for each package (description, homepage, dependencies, conflicts)
- **Package Removal**: Safe uninstallation with confirmation dialogs
- **Search Function**: Quick search through installed packages

### 🔄 Update Management
- **Outdated Package Detection**: Automatic detection of available updates
- **Individual Updates**: Targeted updates for specific packages
- **Update Logs**: Complete logs of update operations
- **Version Comparison**: Clear display of current vs. latest versions

### 🩺 System Diagnostics
- **Homebrew Doctor**: Integrated diagnostic functionality
- **Problem Detection**: Identification of common Homebrew issues
- **Detailed Logs**: Comprehensive output for troubleshooting

### 🎯 User Experience
- **Modern UI**: Clean, responsive user interface
- **Real-time Updates**: Live refreshing of package lists
- **Intuitive Navigation**: Simple sidebar navigation between functions
- **Confirmation Dialogs**: Safe confirmation for critical actions

## 🚀 Installation & Setup
### Prerequisites
- macOS (Intel or Apple Silicon)
- Homebrew must be installed
- Node.js and npm (for development)

### Development Setup
``` bash
# Clone the repository
git clone https://github.com/wickenico/WailBrew.git
cd WailBrew

# Install Go dependencies
go mod download

# Install frontend dependencies
cd frontend && npm install

# Start the app in development mode
cd .. && wails dev
```
### Production Build
``` bash
# Build the app for production
wails build

# The built app will be in the build/bin/ directory
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

**WailBrew** makes Homebrew management simple and accessible for all macOS users. Try it out and streamline your package management workflow!
