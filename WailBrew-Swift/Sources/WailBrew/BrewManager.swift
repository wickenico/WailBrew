import Foundation
import Combine

struct Package: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let version: String
}

struct OutdatedPackage: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let installedVersion: String
    let latestVersion: String
}

@MainActor
class BrewManager: ObservableObject {
    @Published var installedPackages: [Package] = []
    @Published var outdatedPackages: [OutdatedPackage] = []
    @Published var allPackages: [Package] = []
    @Published var leaves: [String] = []
    @Published var taps: [[String]] = []

    @Published var isLoading: Bool = false
    @Published var commandOutput: String = ""
    @Published var isRunningCommand: Bool = false
    @Published var brewPath: String

    init() {
        // Retrieve saved path or use default
        self.brewPath = UserDefaults.standard.string(forKey: "brewPath") ?? "/opt/homebrew/bin/brew"
    }

    func setBrewPath(_ path: String) -> Bool {
        let fileManager = FileManager.default
        var isDirectory: ObjCBool = false
        if fileManager.fileExists(atPath: path, isDirectory: &isDirectory) && !isDirectory.boolValue && fileManager.isExecutableFile(atPath: path) {
            self.brewPath = path
            UserDefaults.standard.set(path, forKey: "brewPath")
            return true
        }
        return false
    }

    // MARK: - Core Functions

    func fetchInstalledPackages() async {
        isLoading = true
        let output = await runBrewCommand(with: ["list", "--formula", "--versions"])
        self.installedPackages = parseInstalledPackages(from: output)
        isLoading = false
    }

    func fetchOutdatedPackages() async {
        isLoading = true
        // First, get all installed packages
        let installedOutput = await runBrewCommand(with: ["list", "--formula", "--versions"])
        let installed = parseInstalledPackages(from: installedOutput)

        guard !installed.isEmpty else {
            self.outdatedPackages = []
            isLoading = false
            return
        }

        // Then, get info for all installed packages
        let packageNames = installed.map { $0.name }
        var args = ["info", "--json=v2"]
        args.append(contentsOf: packageNames)

        let infoOutput = await runBrewCommand(with: args)
        self.outdatedPackages = parseOutdatedPackages(from: infoOutput, installedPackages: installed)
        isLoading = false
    }

    func fetchAllPackages() async {
        isLoading = true
        let output = await runBrewCommand(with: ["formulae"])
        self.allPackages = parseAllPackages(from: output)
        isLoading = false
    }

    func fetchLeaves() async {
        isLoading = true
        let output = await runBrewCommand(with: ["leaves"])
        self.leaves = output.split(whereSeparator: \.isNewline).map(String.init)
        isLoading = false
    }

    func fetchTaps() async {
        isLoading = true
        let output = await runBrewCommand(with: ["tap"])
        let lines = output.split(whereSeparator: \.isNewline).map(String.init)
        self.taps = lines.map { [$0, "Active"] } // Mimic original structure
        isLoading = false
    }

    func runDoctor() async {
        commandOutput = ""
        isRunningCommand = true
        await runBrewCommandWithStreaming(with: ["doctor"])
        isRunningCommand = false
    }

    func runCleanup() async {
        commandOutput = ""
        isRunningCommand = true
        await runBrewCommandWithStreaming(with: ["cleanup"])
        isRunningCommand = false
    }

    // MARK: - Package Actions

    func installPackage(_ packageName: String) async {
        commandOutput = ""
        isRunningCommand = true
        await runBrewCommandWithStreaming(with: ["install", packageName])
        isRunningCommand = false
        await fetchInstalledPackages()
        await fetchOutdatedPackages()
    }

    func updateAllPackages() async {
        commandOutput = ""
        isRunningCommand = true
        await runBrewCommandWithStreaming(with: ["upgrade"])
        isRunningCommand = false
        await fetchInstalledPackages()
        await fetchOutdatedPackages()
    }

    func uninstallPackage(_ packageName: String) async {
        commandOutput = ""
        isRunningCommand = true
        await runBrewCommandWithStreaming(with: ["uninstall", packageName])
        isRunningCommand = false
        await fetchInstalledPackages()
        await fetchOutdatedPackages()
    }

    func updatePackage(_ packageName: String) async {
        commandOutput = ""
        isRunningCommand = true
        await runBrewCommandWithStreaming(with: ["upgrade", packageName])
        isRunningCommand = false
        await fetchInstalledPackages()
        await fetchOutdatedPackages()
    }

    // MARK: - Helper Functions

    private func runBrewCommandWithStreaming(with arguments: [String]) async {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: brewPath)
        task.arguments = arguments

        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        environment["HOMEBREW_NO_AUTO_UPDATE"] = "1"
        task.environment = environment

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe

        let outHandle = pipe.fileHandleForReading

        let streamTask = Task.detached {
            for try await line in outHandle.bytes.lines {
                await MainActor.run {
                    self.commandOutput += line + "\n"
                }
            }
        }

        do {
            try task.run()
            await withCheckedContinuation { continuation in
                task.terminationHandler = { _ in
                    streamTask.cancel()
                    continuation.resume()
                }
            }
        } catch {
            await MainActor.run {
                self.commandOutput = "Error running brew command: \(error.localizedDescription)"
            }
            streamTask.cancel()
        }
    }

    private func runBrewCommand(with arguments: [String]) async -> String {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: brewPath)
        task.arguments = arguments

        // Set environment to avoid issues with non-standard setups
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        environment["HOMEBREW_NO_AUTO_UPDATE"] = "1"
        task.environment = environment

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe

        do {
            try task.run()
            let data = try pipe.fileHandleForReading.readToEnd()
            task.waitUntilExit()
            if let output = data, let stringOutput = String(data: output, encoding: .utf8) {
                return stringOutput
            }
        } catch {
            return "Error running brew command: \(error.localizedDescription)"
        }
        return "Unknown error"
    }

    // MARK: - Parsers

    private func parseInstalledPackages(from output: String) -> [Package] {
        let lines = output.split(whereSeparator: \.isNewline)
        return lines.compactMap { line in
            let components = line.split(separator: " ").map(String.init)
            guard !components.isEmpty else { return nil }
            let name = components[0]
            let version = components.count > 1 ? components.dropFirst().joined(separator: " ") : "Unknown"
            return Package(name: name, version: version)
        }
    }

    private func parseAllPackages(from output: String) -> [Package] {
        let lines = output.split(whereSeparator: \.isNewline)
        return lines.map { Package(name: String($0), version: "") }
    }

    private func parseOutdatedPackages(from jsonString: String, installedPackages: [Package]) -> [OutdatedPackage] {
        guard let data = jsonString.data(using: .utf8) else { return [] }

        let installedMap = Dictionary(uniqueKeysWithValues: installedPackages.map { ($0.name, $0.version) })

        do {
            let info = try JSONDecoder().decode(BrewInfo.self, from: data)
            return info.formulae.compactMap { formula in
                guard let installedVersion = installedMap[formula.name] else { return nil }
                let latestVersion = formula.versions.stable
                if installedVersion != latestVersion && !formula.deprecated && !formula.disabled {
                    return OutdatedPackage(name: formula.name, installedVersion: installedVersion, latestVersion: latestVersion)
                }
                return nil
            }
        } catch {
            print("Error decoding brew info: \(error)")
            return []
        }
    }
}


// MARK: - JSON Structures for parsing `brew info`

private struct BrewInfo: Codable {
    let formulae: [Formulae]
}

private struct Formulae: Codable {
    let name: String
    let versions: Versions
    let deprecated: Bool
    let disabled: Bool
}

private struct Versions: Codable {
    let stable: String
}