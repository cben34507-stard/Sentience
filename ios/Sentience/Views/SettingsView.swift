import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var sync: SyncService
    @State private var url = ""
    @State private var healthOn = false
    @State private var pingResult: String?
    @State private var healthError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("http://192.168.1.20:4477", text: $url)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .onChange(of: url) { _, v in sync.serverURL = v }
                    Button("Test connection") { Task { await ping() } }
                    if let pingResult { Text(pingResult).font(.footnote).foregroundStyle(.secondary) }
                } header: { Text("Home server") } footer: {
                    Text("The address the server prints on startup (the one marked “network”). The phone needs to be on the same Wi-Fi.")
                }

                Section {
                    Toggle("Send Apple Health data", isOn: $healthOn)
                        .onChange(of: healthOn) { _, on in
                            sync.healthEnabled = on
                            if on { Task { await enableHealth() } }
                        }
                    if let healthError { Text(healthError).font(.footnote).foregroundStyle(.red) }
                } header: { Text("HealthKit") } footer: {
                    Text("Heart rate, resting HR, HRV, steps, distance, active energy, exercise minutes, SpO₂, weight, sleep and workouts. The first sync sends the last 90 days; use the web importer for full history.")
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
                healthOn = sync.healthEnabled
            }
        }
    }

    private func ping() async {
        guard let api = APIClient.configured else { pingResult = "Enter a full URL first"; return }
        do { pingResult = try await api.ping() ? "Connected ✓" : "Unexpected reply" }
        catch { pingResult = error.localizedDescription }
    }

    private func enableHealth() async {
        guard HealthKitService.available else { healthError = "HealthKit is not available on this device"; return }
        do { try await HealthKitService.shared.requestAuthorization(); healthError = nil }
        catch { healthError = error.localizedDescription }
    }
}
