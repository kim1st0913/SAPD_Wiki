// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "SAPDWiki",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "SAPDWiki", targets: ["SAPDWiki"]),
        .executable(
            name: "SAPDWikiKeychainRepair",
            targets: ["SAPDWikiKeychainRepair"]
        )
    ],
    targets: [
        .executableTarget(
            name: "SAPDWiki",
            path: "Sources/SAPDWiki"
        ),
        .executableTarget(
            name: "SAPDWikiKeychainRepair",
            path: "Sources/SAPDWikiKeychainRepair",
            linkerSettings: [
                .linkedFramework("Foundation"),
                .linkedFramework("Security")
            ]
        )
    ]
)
