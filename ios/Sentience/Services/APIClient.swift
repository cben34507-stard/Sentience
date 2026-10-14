import Foundation

enum APIError: LocalizedError {
    case noServer
    case http(Int, String)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .noServer: "No server URL set. Open Settings and paste the address the server prints on startup."
        case let .http(code, msg): "Server said \(code): \(msg)"
        case let .decoding(e): "Could not read server response: \(e.localizedDescription)"
        }
    }
}

/// Thin JSON client for the Sentience server.
struct APIClient {
    var baseURL: URL

    static var configured: APIClient? {
        guard let raw = UserDefaults.standard.string(forKey: AppSettings.serverURLKey),
              let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.host != nil else { return nil }
        return APIClient(baseURL: url)
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
        let (data, response) = try await session.data(for: req)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else {
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? String(data: data, encoding: .utf8) ?? ""
            throw APIError.http(code, msg)
        }
        do { return try Self.decoder.decode(T.self, from: data) } catch { throw APIError.decoding(error) }
    }

    struct Ping: Decodable { let ok: Bool }
    func ping() async throws -> Bool { try await (get("/health-check") as Ping).ok }
}

enum AppSettings {
    static let serverURLKey = "sentience.serverURL"
    static let deviceIdKey = "sentience.deviceId"
    static let cursorKey = "sentience.syncCursor"
    static let lastSyncKey = "sentience.lastSync"
    static let healthAnchorKey = "sentience.healthAnchor."
    static let healthEnabledKey = "sentience.healthEnabled"

    static var deviceId: String {
        if let id = UserDefaults.standard.string(forKey: deviceIdKey) { return id }
        let id = "ios-" + UUID().uuidString.lowercased().prefix(8)
        UserDefaults.standard.set(id, forKey: deviceIdKey)
        return id
    }
}
