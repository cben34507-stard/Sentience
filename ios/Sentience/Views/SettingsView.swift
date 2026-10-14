import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var sync: SyncService
    @State private var url = ""
    @State private var token = ""
    @State private var healthOn = false
    @State private var writeLabs = false
    @State private var pingResult: String?
    @State private var healthError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("http://192.168.1.20:4477", text: $url)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .onChange(of: url) { _, v in sync.serverURL = v }
                    SecureField("Device token (snt_…)", text: $token)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .onChange(of: token) { _, v in Keychain.set(AppSettings.tokenKey, v.trimmingCharacters(in: .whitespacesAndNewlines)) }
                    Button("Test connection") { Task { await ping() } }
                    if let pingResult { Text(pingResult).font(.footnote).foregroundStyle(.secondary) }
                } header: { Text("Home server") } footer: {
                    Text("The address the server prints on startup (the one marked “network”). For the token, open the web app, go to Settings, Devices, Add device, and paste it here. It is kept in the iPhone Keychain.")
                }

                Section {
                    Toggle("Send Apple Health data", isOn: $healthOn)
                        .onChange(of: healthOn) { _, on in
                            sync.healthEnabled = on
                            if on { Task { await enableHealth() } }
                        }
                    Toggle("Write test results to Apple Health", isOn: $writeLabs)
                        .onChange(of: writeLabs) { _, on in
                            sync.writeLabsToHealth = on
                            if on { Task { await enableHealth(write: true); await sync.writePendingLabsToHealth() } }
                        }
                    if let healthError { Text(healthError).font(.footnote).foregroundStyle(.red) }
                } header: { Text("HealthKit") } footer: {
                    Text("Reading: heart rate, resting HR, HRV, steps, distance, active energy, exercise minutes, SpO₂, weight, sleep, workouts, and food and water logged by apps such as MyFitnessPal. The first sync sends the last 90 days; the web importer handles full history, and nothing is stored twice. Writing: glucose, blood pressure, oxygen, temperature, pulse, weight, BMI, body fat, waist and lung-function results. Apple keeps lab panels such as cholesterol read-only, so those stay in Sentience.")
                }

                Section("Sync") {
                    Button {
                        Task { await sync.sync() }
                    } label: {
                        HStack { Text("Sync now"); Spacer(); if sync.isSyncing { ProgressView() } }
                    }
                    .disabled(sync.isSyncing)
                    LabeledContent("Last sync", value: sync.lastSync.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? "never")
                    if let s = sync.lastSummary { Text(s).font(.footnote).foregroundStyle(.secondary) }
                    if let e = sync.lastError { Text(e).font(.footnote).foregroundStyle(.red) }
                    LabeledContent("Device", value: AppSettings.deviceId)
                    if let p = sync.profile, !p.name.isEmpty { LabeledContent("Profile", value: p.name) }
                    Button("Re-send everything", role: .destructive) { sync.resetCursor(); Task { await sync.sync() } }
                }

                Section {
                    Text("Sentience logs your day offline. When the phone can reach the server it pushes events and HealthKit samples and pulls anything you changed on the web.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Sync")
            .onAppear {
                url = sync.serverURL
                token = Keychain.get(AppSettings.tokenKey) ?? ""
                healthOn = sync.healthEnabled
                writeLabs = sync.writeLabsToHealth
            }
        }
    }

    private func ping() async {
        guard let api = APIClient.configured else { pingResult = "Enter a full URL first"; return }
        do {
            guard try await api.ping() else { pingResult = "Unexpected reply"; return }
            pingResult = try await api.checkAuth() ? "Connected and signed in" : "Reachable, but the token was not accepted"
        }
        catch { pingResult = error.localizedDescription }
    }

    private func enableHealth(write: Bool = false) async {
        guard HealthKitService.available else { healthError = "HealthKit is not available on this device"; return }
        do { try await HealthKitService.shared.requestAuthorization(write: write || sync.writeLabsToHealth); healthError = nil }
        catch { healthError = error.localizedDescription }
    }
}
