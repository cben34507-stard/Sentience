import SwiftUI
import SwiftData

@main
struct SentienceApp: App {
    @State private var showSplash = true
    @StateObject private var sync = SyncService.shared

    let container: ModelContainer = {
        let schema = Schema([LocalEvent.self, LocalGoal.self, LocalGoalProgress.self, LocalLabResult.self])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Could not create SwiftData container: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ZStack {
                ContentView()
                    .environmentObject(sync)
                if showSplash {
                    SplashView { withAnimation(.easeOut(duration: 0.45)) { showSplash = false } }
                        .transition(.opacity.combined(with: .scale(scale: 1.04)))
                        .zIndex(10)
                }
            }
            .onAppear {
                sync.attach(container: container)
                Task { await sync.syncIfPossible() }
            }
        }
        .modelContainer(container)
    }
}
