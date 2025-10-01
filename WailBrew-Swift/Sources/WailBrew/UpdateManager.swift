import Foundation
import SwiftUI

struct GitHubRelease: Codable {
    let tagName: String
    let name: String
    let body: String
    let htmlURL: String
    let publishedAt: String

    enum CodingKeys: String, CodingKey {
        case tagName = "tag_name"
        case name, body
        case htmlURL = "html_url"
        case publishedAt = "published_at"
    }
}

@MainActor
class UpdateManager: ObservableObject {
    @Published var isCheckingForUpdate = false
    @Published var updateAvailable: GitHubRelease?
    @Published var checkingError: String?

    private let repoURL = URL(string: "https://api.github.com/repos/wickenico/WailBrew/releases/latest")!

    func checkForUpdates() async {
        isCheckingForUpdate = true
        updateAvailable = nil
        checkingError = nil

        do {
            let (data, _) = try await URLSession.shared.data(for: URLRequest(url: repoURL))
            let release = try JSONDecoder().decode(GitHubRelease.self, from: data)

            // Compare versions
            if let currentVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
                if release.tagName.compare(currentVersion, options: .numeric) == .orderedDescending {
                    updateAvailable = release
                } else {
                    // This will be handled by the view to show "You're up-to-date"
                    updateAvailable = nil
                }
            } else {
                // If current version is not available, assume update is available
                updateAvailable = release
            }
        } catch {
            checkingError = "Failed to check for updates: \(error.localizedDescription)"
        }

        isCheckingForUpdate = false
    }

    func openURL(_ url: URL) {
        #if os(macOS)
        NSWorkspace.shared.open(url)
        #endif
    }
}