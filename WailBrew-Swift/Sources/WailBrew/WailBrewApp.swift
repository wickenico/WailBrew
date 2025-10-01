import SwiftUI

@main
struct WailBrewApp: App {
    @StateObject private var brewManager = BrewManager()
    @StateObject private var updateManager = UpdateManager()
    @State private var showAboutView = false
    @State private var showUpdateAlert = false

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(brewManager)
                .environmentObject(updateManager)
                .sheet(isPresented: $showAboutView) {
                    AboutView()
                }
                .alert(isPresented: $showUpdateAlert) {
                    if let release = updateManager.updateAvailable {
                        return Alert(
                            title: Text("Update Available"),
                            message: Text("Version \(release.tagName) is available. You are running version \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown")."),
                            primaryButton: .default(Text("Go to Download"), action: {
                                if let url = URL(string: release.htmlURL) {
                                    updateManager.openURL(url)
                                }
                            }),
                            secondaryButton: .cancel()
                        )
                    } else if updateManager.checkingError != nil {
                         return Alert(
                            title: Text("Error"),
                            message: Text(updateManager.checkingError ?? "An unknown error occurred."),
                            dismissButton: .default(Text("OK"))
                        )
                    } else {
                        return Alert(
                            title: Text("You're Up-to-Date"),
                            message: Text("You are running the latest version of WailBrew."),
                            dismissButton: .default(Text("OK"))
                        )
                    }
                }
        }
        .windowStyle(HiddenTitleBarWindowStyle())
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("About WailBrew") {
                    showAboutView = true
                }
            }
            CommandMenu("Help") {
                Button("WailBrew Website") {
                    if let url = URL(string: "https://wailbrew.app") {
                        updateManager.openURL(url)
                    }
                }
                Button("GitHub Repository") {
                    if let url = URL(string: "https://github.com/wickenico/WailBrew") {
                        updateManager.openURL(url)
                    }
                }
            }
            CommandGroup(after: .appInfo) {
                Button("Check for Updates...") {
                    Task {
                        await updateManager.checkForUpdates()
                        showUpdateAlert = true
                    }
                }
            }
        }
    }
}

struct AboutView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .frame(width: 64, height: 64)
            Text("WailBrew")
                .font(.largeTitle)
            Text("Version \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown")")
                .font(.body)
            Text("A modern, user-friendly graphical interface for Homebrew package management on macOS.")
                .font(.body)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button("Close") {
                // How to close the sheet? The sheet has its own close button.
                // This button is for users who might look for an explicit close button.
                // We can find the presenting window and close it.
                NSApplication.shared.keyWindow?.close()
            }
        }
        .padding(40)
        .frame(minWidth: 400, minHeight: 300)
    }
}