// swift-tools-version:5.5
import PackageDescription

let package = Package(
    name: "WailBrew",
    platforms: [
        .macOS(.v12)
    ],
    products: [
        .executable(
            name: "WailBrew",
            targets: ["WailBrew"])
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "WailBrew",
            dependencies: [])
    ]
)