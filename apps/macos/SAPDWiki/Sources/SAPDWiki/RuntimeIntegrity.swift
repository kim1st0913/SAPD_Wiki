import CryptoKit
import Foundation

enum RuntimeIntegrityError: LocalizedError {
    case invalid(String)

    var errorDescription: String? {
        switch self {
        case .invalid(let message): return message
        }
    }
}

enum RuntimeIntegrity {
    static func rejectSymbolicLinksInWritePath(_ target: URL) throws {
        var current = URL(fileURLWithPath: "/", isDirectory: true)
        for component in target.pathComponents.dropFirst() {
            current.appendPathComponent(component)
            guard FileManager.default.fileExists(atPath: current.path) else { continue }
            let attributes = try FileManager.default.attributesOfItem(atPath: current.path)
            if attributes[.type] as? FileAttributeType == .typeSymbolicLink {
                throw RuntimeIntegrityError.invalid("Runtime install write path contains a symbolic link: \(current.path)")
            }
        }
    }

    static func validateRequiredContentAssetDatabase(root: URL) throws {
        let baseRoot = root.appendingPathComponent("data/base", isDirectory: true)
        let manifestURL = baseRoot.appendingPathComponent("base-manifest.json")
        try rejectSymbolicLinksInWritePath(manifestURL)
        let data: Data
        do {
            data = try Data(contentsOf: manifestURL)
        } catch {
            throw RuntimeIntegrityError.invalid("Runtime manifest is missing or unreadable: \(manifestURL.path)")
        }
        guard
            let manifest = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let declaration = manifest["content_asset_database"] as? [String: Any],
            let file = declaration["file"] as? String,
            !file.isEmpty,
            let expectedHash = declaration["sha256"] as? String,
            expectedHash.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil
        else {
            throw RuntimeIntegrityError.invalid("Runtime content asset database manifest declaration is missing or invalid.")
        }
        guard URL(fileURLWithPath: file).lastPathComponent == file, file != ".", file != ".." else {
            throw RuntimeIntegrityError.invalid("Runtime content asset database manifest path is invalid: \(file)")
        }
        let assetURL = baseRoot.appendingPathComponent(file)
        try rejectSymbolicLinksInWritePath(assetURL)
        guard FileManager.default.fileExists(atPath: assetURL.path) else {
            throw RuntimeIntegrityError.invalid("Required Runtime content asset database is missing: \(assetURL.path)")
        }
        let actualHash = try sha256(file: assetURL)
        guard actualHash == expectedHash else {
            throw RuntimeIntegrityError.invalid(
                "Runtime content asset database hash mismatch: expected=\(expectedHash); actual=\(actualHash)"
            )
        }
    }

    private static func sha256(file: URL) throws -> String {
        var digest = SHA256()
        try update(&digest, withFile: file)
        return digest.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private static func update(_ digest: inout SHA256, withFile url: URL) throws {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        while true {
            let data = try handle.read(upToCount: 1024 * 1024) ?? Data()
            if data.isEmpty { break }
            digest.update(data: data)
        }
    }
}
