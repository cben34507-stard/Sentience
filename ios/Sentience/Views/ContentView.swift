import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var sync: SyncService
    @Environment(\.scenePhase) private var phase

    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "clock") }
            TestsView()
                .tabItem { Label("Tests", systemImage: "flask") }
            GoalsView()
                .tabItem { Label("Goals", systemImage: "target") }
            SettingsView()
                .tabItem { Label("Sync", systemImage: "arrow.triangle.2.circlepath") }
        }
        .tint(.primary)
        .onChange(of: phase) { _, p in
            // Coming home and unlocking the phone is the moment the mini PC is reachable.
            if p == .active { Task { await sync.syncIfPossible() } }
        }
    }
}
