// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "SAPDWiki",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "SAPDWiki", targets: ["SAPDWiki"])
    ],
    targets: [
        .target(
            name: "SAPDWikiMCPControl",
            path: "Sources/SAPDWikiMCPControl"
        ),
        .executableTarget(
            name: "SAPDWiki",
            dependencies: ["SAPDWikiMCPControl"],
            path: "Sources/SAPDWiki"
        ),
        .testTarget(
            name: "SAPDWikiMCPControlTests",
            dependencies: ["SAPDWikiMCPControl"],
            path: "Tests/SAPDWikiMCPControlTests"
        )
    ]
)
