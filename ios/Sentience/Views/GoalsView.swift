import SwiftUI
import SwiftData

/// Goals are authored and measured on the server (it has the health data);
/// the phone shows them and lets you log manual progress offline.
struct GoalsView: View {
    @Query(filter: #Predicate<LocalGoal> { $0.deletedAt == nil && !$0.archived }, sort: \.createdAt) private var goals: [LocalGoal]
    @Environment(\.modelContext) private var ctx
    @EnvironmentObject private var sync: SyncService
    @State private var logging: LocalGoal?
    @State private var amount = "1"
    @State private var adding = false

    var body: some View {
        NavigationStack {
            List {
                if goals.isEmpty {
                    ContentUnavailableView("No goals yet", systemImage: "target", description: Text("Create one here or on the web app. Health-measured goals compute on the server."))
                }
                ForEach(goals) { g in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(g.title).font(.body.weight(.medium))
                            Spacer()
                            if g.metric == "manual" {
                                Button("+ Progress") { logging = g; amount = "1" }.font(.footnote.weight(.semibold)).buttonStyle(.bordered).tint(.primary)
                            }
                        }
                        Text("\(g.target.formatted()) \(g.unit) · \(g.cadence.rawValue) · \(Self.metricLabel(g.metric))")
                            .font(.caption).foregroundStyle(.secondary)
                        if g.metric == "manual" { ManualProgressLine(goal: g) }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Goals")
            .toolbar { Button { adding = true } label: { Image(systemName: "plus") } }
            .sheet(item: $logging) { g in
                NavigationStack {
                    Form {
                        TextField("Amount (\(g.unit))", text: $amount).keyboardType(.decimalPad)
                    }
                    .navigationTitle(g.title)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { logging = nil } }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Log") {
                                ctx.insert(LocalGoalProgress(goalId: g.id, date: ISO.dayString(Date()), amount: Double(amount) ?? 1))
                                try? ctx.save()
                                logging = nil
                                Task { await sync.syncIfPossible() }
                            }
                        }
                    }
                }
                .presentationDetents([.height(200)])
            }
            .sheet(isPresented: $adding) { NewGoalSheet() }
            .refreshable { await sync.sync() }
        }
    }

    static func metricLabel(_ m: String) -> String {
        if m == "manual" { return "logged by hand" }
        if m.hasPrefix("events:") { return "\(m.dropFirst(7)) events" }
        if m.hasPrefix("health:") { return m.dropFirst(7).replacingOccurrences(of: "HKQuantityTypeIdentifier", with: "") }
        return m
    }
}

struct ManualProgressLine: View {
    let goal: LocalGoal
    @Query private var rows: [LocalGoalProgress]

    init(goal: LocalGoal) {
        self.goal = goal
        let id = goal.id
        let today = ISO.dayString(Date())
        _rows = Query(filter: #Predicate<LocalGoalProgress> { $0.goalId == id && $0.date == today })
    }

    var body: some View {
        let sum = rows.reduce(0) { $0 + $1.amount }
        ProgressView(value: min(1, goal.target == 0 ? 1 : sum / goal.target)) {
            Text("Today: \(sum.formatted()) / \(goal.target.formatted())").font(.caption2).foregroundStyle(.secondary)
        }
        .tint(sum >= goal.target ? .green : .primary)
    }
}

struct NewGoalSheet: View {
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var sync: SyncService
    @State private var title = ""
    @State private var target = "1"
    @State private var unit = ""
    @State private var cadence: GoalCadence = .daily

    var body: some View {
        NavigationStack {
            Form {
                TextField("Title", text: $title)
                TextField("Target", text: $target).keyboardType(.decimalPad)
                TextField("Unit (pages, glasses…)", text: $unit)
                Picker("Cadence", selection: $cadence) { ForEach(GoalCadence.allCases) { Text($0.rawValue).tag($0) } }
                Text("Goals measured from Apple Health or timeline events are set up on the web app, where the data lives.").font(.footnote).foregroundStyle(.secondary)
            }
            .navigationTitle("New manual goal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        ctx.insert(LocalGoal(title: title, cadence: cadence, target: Double(target) ?? 1, unit: unit, metric: "manual", startsOn: ISO.dayString(Date())))
                        try? ctx.save()
                        dismiss()
                        Task { await sync.syncIfPossible() }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
