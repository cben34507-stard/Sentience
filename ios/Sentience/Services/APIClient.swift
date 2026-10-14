import Foundation
import Security

enum APIError: LocalizedError {
    case noServer
    case unauthorized
    case http(Int, String)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .noServer: "No server URL set. Open Settings and paste the address the server prints on startup."
        case .unauthorized: "The server needs a device token. On the web app open Settings, Devices, Add device, then paste the token into Sync settings here."
        case let .http(code, msg): "Server said \(code): \(msg)"
        case let .decoding(e): "Could not read server response: \(e.localizedDescription)"
        }
    }
}

/// Thin JSON client for the Sentience server.
struct APIClient {
    var baseURL: URL
    var token: String?

    static var configured: APIClient? {
        guard let raw = UserDefaults.standard.string(forKey: AppSettings.serverURLKey),
              let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.host != nil else { return nil }
        return APIClient(baseURL: url, token: Keychain.get(AppSettings.tokenKey))
    }

    private var session: URLSession {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 30
        c.timeoutIntervalForResource = 300
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        return e
    }()
    private static let decoder = JSONDecoder()

    func get<T: Decodable>(_ path: String) async throws -> T {
        var req = URLRequest(url: baseURL.appendingPathComponent("api" + path))
        req.httpMethod = "GET"
        return try await run(req)
    }

    func post<B: Encodable, T: Decodable>(_ path: String, _ body: B) async throws -> T {
        var req = URLRequest(url: baseURL.appendingPathComponent("api" + path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try Self.encoder.encode(body)
        return try await run(req)
    }

    private func run<T: Decodable>(_ req: URLRequest) async throws -> T {
        var req = req
        if let token, !token.isEmpty { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await session.data(for: req)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        if code == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(code) else {
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? String(data: data, encoding: .utf8) ?? ""
            throw APIError.http(code, msg)
        }
        do { return try Self.decoder.decode(T.self, from: data) } catch { throw APIError.decoding(error) }
    }

    struct Ping: Decodable { let ok: Bool }
    func ping() async throws -> Bool { try await (get("/health-check") as Ping).ok }

    /// Checks the token as well as reachability (health-check is public).
    struct Me: Decodable { let authenticated: Bool }
    func checkAuth() async throws -> Bool { try await (get("/auth/status") as Me).authenticated }
}

enum AppSettings {
    static let serverURLKey = "sentience.serverURL"
    static let tokenKey = "sentience.deviceToken"
    static let deviceIdKey = "sentience.deviceId"
    static let cursorKey = "sentience.syncCursor"
    static let lastSyncKey = "sentience.lastSync"
    static let healthAnchorKey = "sentience.healthAnchor."
    static let healthEnabledKey = "sentience.healthEnabled"
    static let writeLabsKey = "sentience.writeLabsToHealth"

    static var deviceId: String {
        if let id = UserDefaults.standard.string(forKey: deviceIdKey) { return id }
        let id = "ios-" + UUID().uuidString.lowercased().prefix(8)
        UserDefaults.standard.set(id, forKey: deviceIdKey)
        return id
    }
}

/// Device tokens are credentials, so they live in the Keychain rather than UserDefaults.
enum Keychain {
    private static func query(_ key: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "sentience",
         kSecAttrAccount as String: key]
    }

    static func get(_ key: String) -> String? {
        var q = query(key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func set(_ key: String, _ value: String?) {
        SecItemDelete(query(key) as CFDictionary)
        guard let value, !value.isEmpty else { return }
        var q = query(key)
        q[kSecValueData as String] = Data(value.utf8)
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(q as CFDictionary, nil)
    }
}
