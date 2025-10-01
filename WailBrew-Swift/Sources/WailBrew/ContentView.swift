import SwiftUI

struct ContentView: View {
    @State private var selection: NavigationItem = .installed
    @EnvironmentObject var brewManager: BrewManager

    enum NavigationItem {
        case installed, outdated, all, leaves, repositories, doctor, cleanup, settings
    }

    var body: some View {
        ZStack {
            NavigationView {
                List {
                    NavigationLink(destination: InstalledPackagesView(), tag: .installed, selection: $selection) {
                        Label("Installed", systemImage: "shippingbox")
                    }
                    NavigationLink(destination: OutdatedPackagesView(), tag: .outdated, selection: $selection) {
                        Label("Outdated", systemImage: "arrow.up.circle")
                    }
                    NavigationLink(destination: AllPackagesView(), tag: .all, selection: $selection) {
                        Label("All Formulae", systemImage: "list.bullet")
                    }
                    NavigationLink(destination: LeavesView(), tag: .leaves, selection: $selection) {
                        Label("Leaves", systemImage: "leaf")
                    }
                    NavigationLink(destination: RepositoriesView(), tag: .repositories, selection: $selection) {
                        Label("Repositories", systemImage: "folder")
                    }

                    Divider()

                    NavigationLink(destination: DoctorView(), tag: .doctor, selection: $selection) {
                        Label("Doctor", systemImage: "stethoscope")
                    }
                    NavigationLink(destination: CleanupView(), tag: .cleanup, selection: $selection) {
                        Label("Cleanup", systemImage: "trash")
                    }

                    Divider()

                    NavigationLink(destination: SettingsView(), tag: .settings, selection: $selection) {
                        Label("Settings", systemImage: "gear")
                    }
                }
                .listStyle(SidebarListStyle())
                .frame(minWidth: 200)

                Text("Select a category")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .onAppear {
                Task {
                    await brewManager.fetchInstalledPackages()
                }
            }

            if brewManager.isRunningCommand {
                CommandOutputView()
            }
        }
    }
}

// MARK: - Command Output View

struct CommandOutputView: View {
    @EnvironmentObject var brewManager: BrewManager

    var body: some View {
        Color.black.opacity(0.5)
            .edgesIgnoringSafeArea(.all)
            .overlay(
                VStack {
                    Text("Running Command...")
                        .font(.headline)
                        .padding()

                    ScrollView {
                        Text(brewManager.commandOutput)
                            .font(.system(.body, design: .monospaced))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(NSColor.textBackgroundColor))
                    .cornerRadius(8)
                    .padding()
                }
                .frame(width: 600, height: 400)
                .background(Color(NSColor.windowBackgroundColor))
                .cornerRadius(12)
                .shadow(radius: 10)
            )
    }
}


// MARK: - Package List Views

struct InstalledPackagesView: View {
    @EnvironmentObject var brewManager: BrewManager

    var body: some View {
        VStack {
            if brewManager.isLoading && brewManager.installedPackages.isEmpty {
                ProgressView("Loading installed packages...")
            } else {
                Table(brewManager.installedPackages) {
                    TableColumn("Name", value: \.name)
                    TableColumn("Version", value: \.version)
                    TableColumn("Actions") { package in
                        Button("Uninstall") {
                            Task {
                                await brewManager.uninstallPackage(package.name)
                            }
                        }
                        .disabled(brewManager.isRunningCommand)
                    }
                }
            }
        }
        .navigationTitle("Installed Packages")
        .onAppear {
            Task {
                await brewManager.fetchInstalledPackages()
            }
        }
    }
}

struct OutdatedPackagesView: View {
    @EnvironmentObject var brewManager: BrewManager

    var body: some View {
        VStack {
            if brewManager.isLoading && brewManager.outdatedPackages.isEmpty {
                ProgressView("Loading outdated packages...")
            } else {
                Table(brewManager.outdatedPackages) {
                    TableColumn("Name", value: \.name)
                    TableColumn("Installed Version", value: \.installedVersion)
                    TableColumn("Latest Version", value: \.latestVersion)
                    TableColumn("Actions") { package in
                        Button("Update") {
                            Task {
                                await brewManager.updatePackage(package.name)
                            }
                        }
                        .disabled(brewManager.isRunningCommand)
                    }
                }
                Button("Update All") {
                    Task {
                        await brewManager.updateAllPackages()
                    }
                }
                .disabled(brewManager.isRunningCommand)
                .padding()
            }
        }
        .navigationTitle("Outdated Packages")
        .onAppear {
            Task {
                await brewManager.fetchOutdatedPackages()
            }
        }
    }
}

struct AllPackagesView: View {
    @EnvironmentObject var brewManager: BrewManager
    @State private var searchText = ""

    var filteredPackages: [Package] {
        if searchText.isEmpty {
            return brewManager.allPackages
        } else {
            return brewManager.allPackages.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
        }
    }

    var body: some View {
        VStack {
            if brewManager.isLoading && brewManager.allPackages.isEmpty {
                ProgressView("Loading all packages...")
            } else {
                Table(filteredPackages) {
                    TableColumn("Name", value: \.name)
                    TableColumn("Actions") { package in
                        Button("Install") {
                            Task {
                                await brewManager.installPackage(package.name)
                            }
                        }
                        .disabled(brewManager.isRunningCommand)
                    }
                }
            }
        }
        .searchable(text: $searchText)
        .navigationTitle("All Packages")
        .onAppear {
            if brewManager.allPackages.isEmpty {
                Task {
                    await brewManager.fetchAllPackages()
                }
            }
        }
    }
}

struct LeavesView: View {
    @EnvironmentObject var brewManager: BrewManager

    var body: some View {
        VStack {
            if brewManager.isLoading {
                ProgressView("Loading leaves...")
            } else {
                List(brewManager.leaves, id: \.self) { leaf in
                    Text(leaf)
                }
            }
        }
        .navigationTitle("Leaves")
        .onAppear {
            Task {
                await brewManager.fetchLeaves()
            }
        }
    }
}

struct RepositoriesView: View {
    @EnvironmentObject var brewManager: BrewManager

    var body: some View {
        VStack {
            if brewManager.isLoading {
                ProgressView("Loading repositories...")
            } else {
                Table(brewManager.taps, id: \.self) {
                    TableColumn("Repository", value: \.[0])
                    TableColumn("Status", value: \.[1])
                }
            }
        }
        .navigationTitle("Repositories")
        .onAppear {
            Task {
                await brewManager.fetchTaps()
            }
        }
    }
}

struct DoctorView: View {
    @EnvironmentObject var brewManager: BrewManager

    var body: some View {
        VStack {
            Text("Run Homebrew Doctor")
                .font(.title)
            Text("Checks your system for potential problems with Homebrew.")
                .padding()
            Button("Run Doctor") {
                Task {
                    await brewManager.runDoctor()
                }
            }
            .disabled(brewManager.isRunningCommand)
        }
        .navigationTitle("Doctor")
    }
}

struct CleanupView: View {
    @EnvironmentObject var brewManager: BrewManager

    var body: some View {
        VStack {
            Text("Run Homebrew Cleanup")
                .font(.title)
            Text("Removes stale lock files and outdated downloads for all formulae and casks, and removes old versions of installed formulae.")
                .padding()
            Button("Run Cleanup") {
                Task {
                    await brewManager.runCleanup()
                }
            }
            .disabled(brewManager.isRunningCommand)
        }
        .navigationTitle("Cleanup")
    }
}

struct SettingsView: View {
    @EnvironmentObject var brewManager: BrewManager
    @State private var newPath: String = ""
    @State private var statusMessage: String = ""
    @State private var statusColor: Color = .primary

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Homebrew Path")
                .font(.title)

            Text("Configure the path to your Homebrew executable. This is useful if you have a non-standard installation.")
                .foregroundColor(.secondary)

            HStack {
                TextField("Enter brew path", text: $newPath)
                    .textFieldStyle(RoundedBorderTextFieldStyle())

                Button("Save") {
                    if brewManager.setBrewPath(newPath) {
                        statusMessage = "Path saved successfully."
                        statusColor = .green
                    } else {
                        statusMessage = "Invalid path. Please check if the file exists and is executable."
                        statusColor = .red
                    }
                }
            }

            Text(statusMessage)
                .foregroundColor(statusColor)

            Spacer()
        }
        .padding()
        .navigationTitle("Settings")
        .onAppear {
            newPath = brewManager.brewPath
        }
    }
}