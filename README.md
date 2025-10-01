# WailBrew - Homebrew GUI Manager (SwiftUI Edition)

[![Latest Release](https://img.shields.io/github/v/release/wickenico/WailBrew)](https://github.com/wickenico/WailBrew/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/wickenico/WailBrew/total)](https://github.com/wickenico/WailBrew/releases)

## 🍺 About WailBrew

A modern, user-friendly graphical interface for Homebrew package management on macOS. WailBrew simplifies managing your Homebrew formulas with an intuitive desktop application, now built natively with Swift and SwiftUI.

Requests, Questions, Troubleshooting? => [r/WailBrew](https://www.reddit.com/r/WailBrew)

## 📥 Installation

**[Download Latest Version](https://github.com/wickenico/WailBrew/releases/latest)**

*Note: The installation instructions below are for developers. A pre-built version will be available for download soon.*

## 📰 Mentions

- <a href="https://vvmac.com/wordpress_b/wailbrew-pare-homebrew-dune-interface-graphique/" target="_blank" rel="noopener noreferrer">VVMac</a>

## 📸 Screenshots

![WailBrew Screenshot](images/Screenshot.png)

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
- **Modern UI**: Clean, responsive, and native user interface built with SwiftUI.
- **Real-time Updates**: Live refreshing of package lists.
- **Intuitive Navigation**: Simple sidebar navigation between functions.
- **Confirmation Dialogs**: Safe confirmation for critical actions.

## 🚀 Installation & Setup
### Prerequisites
- macOS 12.0 or later
- Xcode 13 or later
- Homebrew must be installed

### Development Setup
```bash
# Clone the repository
git clone https://github.com/wickenico/WailBrew.git
cd WailBrew/WailBrew-Swift

# Open the project in Xcode
xed .

# Or build and run from the command line
swift run
```

### Production Build
```bash
# Navigate to the project directory
cd WailBrew/WailBrew-Swift

# Build the release version
swift build -c release

# The built app will be in the .build/release/ directory
# You can run it directly:
.build/release/WailBrew
```

## 🛠️ Development

### Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

### Live Development
You can use Xcode's live preview feature to see your UI changes in real-time. Open the project in Xcode and select a SwiftUI view to see the preview.

## 📝 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🐛 Troubleshooting
### Common Issues
- **Homebrew not found**: Ensure Homebrew is correctly installed and that the path in the app's settings is correct.
- **Permission errors**: May need to run the app with appropriate permissions.
- **Slow performance**: Close other resource-intensive applications.

### Support
- Create an issue on GitHub for bugs or feature requests
- Check existing issues before creating new ones

## 🏆 Acknowledgments
- SwiftUI community for the framework and resources.
- Cakebrew as inspiration: https://www.cakebrew.com/

**WailBrew** makes Homebrew management simple and accessible for all macOS users. Try it out and streamline your package management workflow!