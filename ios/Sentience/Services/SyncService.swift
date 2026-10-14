import Foundation
import SwiftData
import SwiftUI
import Combine
import HealthKit

/// Pushes dirty rows + new HealthKit samples, pulls server changes since the
/// last cursor, and applies them with last-write-wins. Safe to call often;
/// it no-ops when there's no server or we're already syncing.
@MainActor
final class SyncService: ObservableObject {
    static let shared = SyncService()

    @Published var isSyncing = false
    @Published var lastError: String?
    @Published var lastSync: Date? = UserDefaults.standard.object(forKey: AppSettings.lastSyncKey) as? Date
    @Published var lastSummary: String?
    @Published var profile: ProfileDTO?

    private var container: ModelContainer?

    func attach(container: ModelContainer) { self.container = container }

    var serverURL: String {
        get { UserDefaults.standard.string(forKey: AppSettings.serverURLKey) ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: AppSettings.serverURLKey) }
    }

    var healthEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: AppSettings.healthEnabledKey) }
        set { UserDefaults.standard.set(newValue, forKey: AppSettings.healthEnabledKey) }
    }

    func syncIfPossible() async {
        guard APIClient.configured != nil else { return }
        await sync()
    }

    func sync() async {
        guard !isSyncing, let container else { return }
        guard let api = APIClient.configured else { lastError = APIError.noServer.localizedDescription; return }
        isSyncing = true
        lastError = nil
        defer { isSyncing = false }

        let ctx = ModelContext(container)
        do {
            // 1. Gather dirty local rows.
            let dirtyEvents = try ctx.fetch(FetchDescriptor<LocalEvent>(predicate: #Predicate { $0.dirty }))
            let dirtyGoals = try ctx.fetch(FetchDescriptor<LocalGoal>(predicate: #Predicate { $0.dirty }))
            let dirtyProgress = try ctx.fetch(FetchDescriptor<LocalGoalProgress>(predicate: #Predicate { $0.dirty }))

            // 2. New HealthKit samples (if enabled).
            var samples: [HealthSampleDTO] = []
            var workouts: [HealthWorkoutDTO] = []
            var anchors: [String: HKQueryAnchor] = [:]
            if healthEnabled, HealthKitService.available {
                let r = try await HealthKitService.shared.collectNew()
                samples = r.samples
                workouts = r.workouts
                anchors = r.anchors
            }

            let since = UserDefaults.standard.integer(forKey: AppSettings.cursorKey)
            let push = SyncPush(
                deviceId: AppSettings.deviceId,
                since: since,
                events: dirtyEvents.map(Self.dto),
                goals: dirtyGoals.map(Self.dto),
                goalProgress: dirtyProgress.map(Self.dto),
                healthSamples: samples,
                healthWorkouts: workouts
            )

            // 3. Round trip.
            let pull: SyncPull = try await api.post("/sync", push)

            // 4. Apply server state.
            for e in pull.events { try Self.apply(e, ctx: ctx) }
            for g in pull.goals { try Self.apply(g, ctx: ctx) }
            for p in pull.goalProgress { try Self.apply(p, ctx: ctx) }
            for e in dirtyEvents { e.dirty = false }
            for g in dirtyGoals { g.dirty = false }
            for p in dirtyProgress { p.dirty = false }
            try ctx.save()

            HealthKitService.shared.commit(anchors: anchors)

            UserDefaults.standard.set(pull.cursor, forKey: AppSettings.cursorKey)
            lastSync = Date()
            UserDefaults.standard.set(lastSync, forKey: AppSettings.lastSyncKey)
            profile = pull.profile
            let a = pull.applied
            lastSummary = "↑ \(dirtyEvents.count) events, \(samples.count) health samples · ↓ \(pull.events.count) events" + (a.map { " · server kept \($0.healthSamples) new samples" } ?? "")
        } catch {
            lastError = error.localizedDescription
        }
    }

    func resetCursor() {
        UserDefaults.standard.set(0, forKey: AppSettings.cursorKey)
        HealthKitService.shared.resetAnchors()
    }

    // MARK: - mapping

    static func dto(_ e: LocalEvent) -> EventDTO {
        EventDTO(
            id: e.id, category: e.categoryRaw, title: e.title, notes: e.notes,
            startAt: ISO.string(e.startAt), endAt: e.endAt.map(ISO.string),
            tags: e.tags, rating: e.rating,
            data: e.data.mapValues(AnyCodable.init), source: e.source,
            createdAt: ISO.string(e.createdAt), updatedAt: ISO.string(e.updatedAt),
            deletedAt: e.deletedAt.map(ISO.string)
        )
    }

    static func dto(_ g: LocalGoal) -> GoalDTO {
        GoalDTO(
            id: g.id, title: g.title, description: g.goalDescription, cadence: g.cadenceRaw,
            target: g.target, unit: g.unit, metric: g.metric, color: g.color,
            startsOn: g.startsOn, endsOn: g.endsOn, archived: g.archived,
            createdAt: ISO.string(g.createdAt), updatedAt: ISO.string(g.updatedAt),
            deletedAt: g.deletedAt.map(ISO.string)
        )
    }

    static func dto(_ p: LocalGoalProgress) -> GoalProgressDTO {
        GoalProgressDTO(id: p.id, goalId: p.goalId, date: p.date, amount: p.amount, note: p.note, createdAt: ISO.string(p.createdAt))
    }

    static func apply(_ e: EventDTO, ctx: ModelContext) throws {
        let id = e.id
        let existing = try ctx.fetch(FetchDescriptor<LocalEvent>(predicate: #Predicate { $0.id == id })).first
        let updated = ISO.date(e.updatedAt) ?? Date()
        if let existing {
            if existing.dirty && existing.updatedAt > updated { return } // local edit is newer
            existing.categoryRaw = e.category
            existing.title = e.title
            existing.notes = e.notes
            existing.startAt = ISO.date(e.startAt) ?? existing.startAt
            existing.endAt = e.endAt.flatMap(ISO.date)
            existing.tags = e.tags
            existing.rating = e.rating
            existing.data = e.data.mapValues(\.value)
            existing.source = e.source
            existing.updatedAt = updated
            existing.deletedAt = e.deletedAt.flatMap(ISO.date)
            existing.dirty = false
        } else {
            let ev = LocalEvent(
                id: e.id, category: EventCategory(rawValue: e.category) ?? .note, title: e.title, notes: e.notes,
                startAt: ISO.date(e.startAt) ?? Date(), endAt: e.endAt.flatMap(ISO.date), tags: e.tags, rating: e.rating,
                data: e.data.mapValues(\.value), source: e.source
            )
            ev.createdAt = ISO.date(e.createdAt) ?? Date()
            ev.updatedAt = updated
            ev.deletedAt = e.deletedAt.flatMap(ISO.date)
            ev.dirty = false
            ctx.insert(ev)
        }
    }

    static func apply(_ g: GoalDTO, ctx: ModelContext) throws {
        let id = g.id
        let existing = try ctx.fetch(FetchDescriptor<LocalGoal>(predicate: #Predicate { $0.id == id })).first
        let updated = ISO.date(g.updatedAt) ?? Date()
        let target = existing ?? LocalGoal(id: g.id, title: g.title, cadence: GoalCadence(rawValue: g.cadence) ?? .daily, target: g.target, startsOn: g.startsOn)
        if let existing, existing.dirty && existing.updatedAt > updated { return }
        target.title = g.title
        target.goalDescription = g.description
        target.cadenceRaw = g.cadence
        target.target = g.target
        target.unit = g.unit
        target.metric = g.metric
        target.color = g.color
        target.startsOn = g.startsOn
        target.endsOn = g.endsOn
        target.archived = g.archived
        target.createdAt = ISO.date(g.createdAt) ?? target.createdAt
        target.updatedAt = updated
        target.deletedAt = g.deletedAt.flatMap(ISO.date)
        target.dirty = false
        if existing == nil { ctx.insert(target) }
    }

    static func apply(_ p: GoalProgressDTO, ctx: ModelContext) throws {
        let id = p.id
        if let existing = try ctx.fetch(FetchDescriptor<LocalGoalProgress>(predicate: #Predicate { $0.id == id })).first {
            existing.amount = p.amount
            existing.note = p.note
            existing.date = p.date
            existing.dirty = false
            return
        }
        let row = LocalGoalProgress(goalId: p.goalId, date: p.date, amount: p.amount, note: p.note)
        row.id = p.id
        row.createdAt = ISO.date(p.createdAt) ?? Date()
        row.dirty = false
        ctx.insert(row)
    }
}
