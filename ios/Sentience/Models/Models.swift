import Foundation
import SwiftData

// MARK: - Shared enums (mirror packages/shared)

enum EventCategory: String, CaseIterable, Codable, Identifiable {
    case meal, drink, supplement, medication, hygiene, sleep, wake, movement, workout
    case work, study, social, leisure, mood, symptom, location, chore, note

    var id: String { rawValue }

    var label: String {
        switch self {
        case .meal: "Meal"; case .drink: "Drink"; case .supplement: "Supplement"
        case .medication: "Medication"; case .hygiene: "Hygiene"; case .sleep: "Sleep"
        case .wake: "Wake"; case .movement: "Movement"; case .workout: "Workout"
        case .work: "Work"; case .study: "Study"; case .social: "Social"
        case .leisure: "Leisure"; case .mood: "Mood"; case .symptom: "Symptom"
        case .location: "Location"; case .chore: "Chore"; case .note: "Note"
        }
    }

    /// SF Symbol for this category.
    var symbol: String {
        switch self {
        case .meal: "fork.knife"; case .drink: "cup.and.saucer"; case .supplement: "pills"
        case .medication: "cross.case"; case .hygiene: "shower"; case .sleep: "moon.zzz"
        case .wake: "sunrise"; case .movement: "figure.walk"; case .workout: "dumbbell"
        case .work: "briefcase"; case .study: "book"; case .social: "person.2"
        case .leisure: "gamecontroller"; case .mood: "brain.head.profile"; case .symptom: "thermometer.medium"
        case .location: "mappin.and.ellipse"; case .chore: "basket"; case .note: "note.text"
        }
    }

    var ranged: Bool {
        [.sleep, .workout, .work, .study, .social, .leisure, .movement].contains(self)
    }
}

enum GoalCadence: String, CaseIterable, Codable, Identifiable {
    case daily, weekly, monthly, once
    var id: String { rawValue }
}

// MARK: - SwiftData models
// Every row carries the same fields as the server so sync is a straight upsert.

@Model
final class LocalEvent {
    @Attribute(.unique) var id: String
    var categoryRaw: String
    var title: String
    var notes: String?
    var startAt: Date
    var endAt: Date?
    var tags: [String]
    var rating: Double?
    /// JSON-encoded dictionary of extras ({"kcal": 620}).
    var dataJSON: String
    var source: String
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    /// True until the server has acknowledged this version.
    var dirty: Bool

    init(
        id: String = UUID().uuidString.lowercased(),
        category: EventCategory,
        title: String,
        notes: String? = nil,
        startAt: Date,
        endAt: Date? = nil,
        tags: [String] = [],
        rating: Double? = nil,
        data: [String: Any] = [:],
        source: String = "ios"
    ) {
        self.id = id
        self.categoryRaw = category.rawValue
        self.title = title
        self.notes = notes
        self.startAt = startAt
        self.endAt = endAt
        self.tags = tags
        self.rating = rating
        self.dataJSON = (try? String(data: JSONSerialization.data(withJSONObject: data), encoding: .utf8)) ?? "{}"
        self.source = source
        let now = Date()
        self.createdAt = now
        self.updatedAt = now
        self.deletedAt = nil
        self.dirty = true
    }

    var category: EventCategory {
        get { EventCategory(rawValue: categoryRaw) ?? .note }
        set { categoryRaw = newValue.rawValue }
    }

    var data: [String: Any] {
        get { (try? JSONSerialization.jsonObject(with: Data(dataJSON.utf8))) as? [String: Any] ?? [:] }
        set { dataJSON = (try? String(data: JSONSerialization.data(withJSONObject: newValue), encoding: .utf8)) ?? "{}" }
    }

    func touch() {
        updatedAt = Date()
        dirty = true
    }
}

@Model
final class LocalGoal {
    @Attribute(.unique) var id: String
    var title: String
    var goalDescription: String
    var cadenceRaw: String
    var target: Double
    var unit: String
    var metric: String
    var color: String
    var startsOn: String   // YYYY-MM-DD
    var endsOn: String?
    var archived: Bool
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var dirty: Bool

    init(id: String = UUID().uuidString.lowercased(), title: String, cadence: GoalCadence, target: Double, unit: String = "", metric: String = "manual", startsOn: String) {
        self.id = id
        self.title = title
        self.goalDescription = ""
        self.cadenceRaw = cadence.rawValue
        self.target = target
        self.unit = unit
        self.metric = metric
        self.color = "blue"
        self.startsOn = startsOn
        self.endsOn = nil
        self.archived = false
        let now = Date()
        self.createdAt = now
        self.updatedAt = now
        self.deletedAt = nil
        self.dirty = true
    }

    var cadence: GoalCadence {
        get { GoalCadence(rawValue: cadenceRaw) ?? .daily }
        set { cadenceRaw = newValue.rawValue }
    }
}

@Model
final class LocalGoalProgress {
    @Attribute(.unique) var id: String
    var goalId: String
    var date: String
    var amount: Double
    var note: String?
    var createdAt: Date
    var dirty: Bool

    init(goalId: String, date: String, amount: Double, note: String? = nil) {
        self.id = UUID().uuidString.lowercased()
        self.goalId = goalId
        self.date = date
        self.amount = amount
        self.note = note
        self.createdAt = Date()
        self.dirty = true
    }
}

@Model
final class LocalLabResult {
    @Attribute(.unique) var id: String
    var testKey: String
    var name: String
    var panel: String
    var value: Double?
    var valueText: String?
    var unit: String
    var refLow: Double?
    var refHigh: Double?
    var takenAt: Date
    var lab: String
    var notes: String
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var dirty: Bool
    /// SyncVersion last written to Apple Health (0 = never). Local only.
    var healthKitVersion: Int = 0
    var healthKitError: String?

    init(preset: LabPreset?, name: String, value: Double?, valueText: String? = nil, unit: String, refLow: Double?, refHigh: Double?, takenAt: Date, lab: String = "", notes: String = "") {
        self.id = UUID().uuidString.lowercased()
        self.testKey = preset?.key ?? "custom"
        self.name = name
        self.panel = preset?.panel ?? "Other"
        self.value = value
        self.valueText = valueText
        self.unit = unit
        self.refLow = refLow
        self.refHigh = refHigh
        self.takenAt = takenAt
        self.lab = lab
        self.notes = notes
        let now = Date()
        self.createdAt = now
        self.updatedAt = now
        self.deletedAt = nil
        self.dirty = true
    }

    var preset: LabPreset? { LabPreset.byKey[testKey] }

    /// Monotonic version for HealthKit's sync-identifier replacement.
    var syncVersion: Int { Int(updatedAt.timeIntervalSince1970 * 1000) }

    enum Flag { case low, normal, high, unknown }
    var flag: Flag {
        guard let v = value, refLow != nil || refHigh != nil else { return .unknown }
        if let lo = refLow, v < lo { return .low }
        if let hi = refHigh, v > hi { return .high }
        return .normal
    }

    func touch() {
        updatedAt = Date()
        dirty = true
    }
}

// MARK: - Wire DTOs (match the zod schemas in packages/shared)

struct LabResultDTO: Codable {
    var id: String
    var testKey: String
    var name: String
    var panel: String
    var value: Double?
    var valueText: String?
    var unit: String
    var refLow: Double?
    var refHigh: Double?
    var takenAt: String
    var lab: String
    var notes: String
    var createdAt: String
    var updatedAt: String
    var deletedAt: String?
}

struct EventDTO: Codable {
    var id: String
    var category: String
    var title: String
    var notes: String?
    var startAt: String
    var endAt: String?
    var tags: [String]
    var rating: Double?
    var data: [String: AnyCodable]
    var source: String
    var createdAt: String
    var updatedAt: String
    var deletedAt: String?
}

struct GoalDTO: Codable {
    var id: String
    var title: String
    var description: String
    var cadence: String
    var target: Double
    var unit: String
    var metric: String
    var color: String
    var startsOn: String
    var endsOn: String?
    var archived: Bool
    var createdAt: String
    var updatedAt: String
    var deletedAt: String?
}

struct GoalProgressDTO: Codable {
    var id: String
    var goalId: String
    var date: String
    var amount: Double
    var note: String?
    var createdAt: String
}

struct HealthSampleDTO: Codable {
    var id: String
    var type: String
    var startAt: String
    var endAt: String
    var value: Double
    var unit: String
    var sourceName: String
    var device: String?
    var categoryValue: String?
}

struct HealthWorkoutDTO: Codable {
    var id: String
    var activityType: String
    var startAt: String
    var endAt: String
    var durationMin: Double
    var energyKcal: Double?
    var distanceKm: Double?
    var sourceName: String
}

struct ProfileDTO: Codable {
    var name: String
    var dateOfBirth: String?
    var sex: String
    var heightCm: Double?
    var weightKg: Double?
    var timezone: String
    var bio: String
    var updatedAt: String
}

struct SyncPush: Codable {
    var deviceId: String
    var since: Int
    var events: [EventDTO]
    var goals: [GoalDTO]
    var goalProgress: [GoalProgressDTO]
    var facts: [AnyCodable] = []
    var labResults: [LabResultDTO]
    var healthSamples: [HealthSampleDTO]
    var healthWorkouts: [HealthWorkoutDTO]
}

struct SyncPull: Codable {
    var cursor: Int
    var serverTime: String
    var events: [EventDTO]
    var goals: [GoalDTO]
    var goalProgress: [GoalProgressDTO]
    var labResults: [LabResultDTO]
    var profile: ProfileDTO
    var applied: Applied?

    struct Applied: Codable {
        var events: Int
        var goals: Int
        var goalProgress: Int
        var facts: Int
        var labResults: Int?
        var healthSamples: Int
        var healthWorkouts: Int
        var healthSkipped: Int?
    }
}

/// Minimal type-erased Codable for the free-form `data` bag.
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { value = NSNull() }
        else if let b = try? c.decode(Bool.self) { value = b }
        else if let i = try? c.decode(Int.self) { value = i }
        else if let d = try? c.decode(Double.self) { value = d }
        else if let s = try? c.decode(String.self) { value = s }
        else if let a = try? c.decode([AnyCodable].self) { value = a.map(\.value) }
        else if let o = try? c.decode([String: AnyCodable].self) { value = o.mapValues(\.value) }
        else { throw DecodingError.dataCorruptedError(in: c, debugDescription: "unsupported JSON") }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch value {
        case is NSNull: try c.encodeNil()
        case let b as Bool: try c.encode(b)
        case let i as Int: try c.encode(i)
        case let d as Double: try c.encode(d)
        case let s as String: try c.encode(s)
        case let a as [Any]: try c.encode(a.map(AnyCodable.init))
        case let o as [String: Any]: try c.encode(o.mapValues(AnyCodable.init))
        default: try c.encode(String(describing: value))
        }
    }
}

// MARK: - Date helpers

enum ISO {
    static let formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
    static func string(_ d: Date) -> String { formatter.string(from: d) }
    static func date(_ s: String) -> Date? { formatter.date(from: s) ?? plain.date(from: s) }

    static let day: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()
    static func dayString(_ d: Date) -> String { day.string(from: d) }
}
