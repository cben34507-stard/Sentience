import Foundation
import HealthKit

/// Reads the handful of HealthKit types the timeline cares about and hands
/// them to the sync service as DTOs. Uses anchored queries so each sync only
/// ships what's new.
final class HealthKitService {
    static let shared = HealthKitService()
    private let store = HKHealthStore()

    static var available: Bool { HKHealthStore.isHealthDataAvailable() }

    private let quantityTypes: [(HKQuantityTypeIdentifier, HKUnit, String)] = [
        (.heartRate, HKUnit.count().unitDivided(by: .minute()), "count/min"),
        (.restingHeartRate, HKUnit.count().unitDivided(by: .minute()), "count/min"),
        (.heartRateVariabilitySDNN, .secondUnit(with: .milli), "ms"),
        (.stepCount, .count(), "count"),
        (.distanceWalkingRunning, .meterUnit(with: .kilo), "km"),
        (.activeEnergyBurned, .kilocalorie(), "kcal"),
        (.appleExerciseTime, .minute(), "min"),
        (.oxygenSaturation, .percent(), "%"),
        (.bodyMass, .gramUnit(with: .kilo), "kg"),
        (.respiratoryRate, HKUnit.count().unitDivided(by: .minute()), "count/min"),
    ]

    func requestAuthorization() async throws {
        var read: Set<HKObjectType> = Set(quantityTypes.compactMap { HKObjectType.quantityType(forIdentifier: $0.0) })
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { read.insert(sleep) }
        read.insert(HKObjectType.workoutType())
        try await store.requestAuthorization(toShare: [], read: read)
    }

    /// Returns new samples since the last anchor for each type; call `commit`
    /// with the returned anchors only after the server accepted the batch.
    func collectNew(limitPerType: Int = 20_000) async throws -> (samples: [HealthSampleDTO], workouts: [HealthWorkoutDTO], anchors: [String: HKQueryAnchor]) {
        var samples: [HealthSampleDTO] = []
        var workouts: [HealthWorkoutDTO] = []
        var anchors: [String: HKQueryAnchor] = [:]

        for (id, unit, unitName) in quantityTypes {
            guard let type = HKObjectType.quantityType(forIdentifier: id) else { continue }
            let (new, anchor) = try await anchored(type: type, key: id.rawValue, limit: limitPerType)
            for s in new.compactMap({ $0 as? HKQuantitySample }) {
                samples.append(HealthSampleDTO(
                    id: s.uuid.uuidString.lowercased(),
                    type: id.rawValue,
                    startAt: ISO.string(s.startDate),
                    endAt: ISO.string(s.endDate),
                    value: s.quantity.doubleValue(for: unit),
                    unit: unitName,
                    sourceName: s.sourceRevision.source.name,
                    device: s.device?.name,
                    categoryValue: nil
                ))
            }
            anchors[id.rawValue] = anchor
        }

        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            let (new, anchor) = try await anchored(type: sleep, key: "sleep", limit: limitPerType)
            for s in new.compactMap({ $0 as? HKCategorySample }) {
                samples.append(HealthSampleDTO(
                    id: s.uuid.uuidString.lowercased(),
                    type: "HKCategoryTypeIdentifierSleepAnalysis",
                    startAt: ISO.string(s.startDate),
                    endAt: ISO.string(s.endDate),
                    value: s.endDate.timeIntervalSince(s.startDate) / 60,
                    unit: "min",
                    sourceName: s.sourceRevision.source.name,
                    device: s.device?.name,
                    categoryValue: Self.sleepValueName(s.value)
                ))
            }
            anchors["sleep"] = anchor
        }

        let (newWorkouts, wAnchor) = try await anchored(type: HKObjectType.workoutType(), key: "workout", limit: limitPerType)
        for w in newWorkouts.compactMap({ $0 as? HKWorkout }) {
            let energy = w.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie())
            let distance = w.statistics(for: HKQuantityType(.distanceWalkingRunning))?.sumQuantity()?.doubleValue(for: .meterUnit(with: .kilo))
                ?? w.statistics(for: HKQuantityType(.distanceCycling))?.sumQuantity()?.doubleValue(for: .meterUnit(with: .kilo))
            workouts.append(HealthWorkoutDTO(
                id: w.uuid.uuidString.lowercased(),
                activityType: Self.activityName(w.workoutActivityType),
                startAt: ISO.string(w.startDate),
                endAt: ISO.string(w.endDate),
                durationMin: (w.duration / 60 * 10).rounded() / 10,
                energyKcal: energy,
                distanceKm: distance,
                sourceName: w.sourceRevision.source.name
            ))
        }
        anchors["workout"] = wAnchor

        return (samples, workouts, anchors)
    }

    func commit(anchors: [String: HKQueryAnchor]) {
        for (key, anchor) in anchors {
            if let data = try? NSKeyedArchiver.archivedData(withRootObject: anchor, requiringSecureCoding: true) {
                UserDefaults.standard.set(data, forKey: AppSettings.healthAnchorKey + key)
            }
        }
    }

    func resetAnchors() {
        let d = UserDefaults.standard
        for key in d.dictionaryRepresentation().keys where key.hasPrefix(AppSettings.healthAnchorKey) { d.removeObject(forKey: key) }
    }

    private func loadAnchor(_ key: String) -> HKQueryAnchor? {
        guard let data = UserDefaults.standard.data(forKey: AppSettings.healthAnchorKey + key) else { return nil }
        return try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data)
    }

    private func anchored(type: HKSampleType, key: String, limit: Int) async throws -> ([HKSample], HKQueryAnchor?) {
        // First run: only look back 90 days so the initial sync is sane; the
        // web importer handles full history from export.zip.
        let predicate: NSPredicate? = loadAnchor(key) == nil
            ? HKQuery.predicateForSamples(withStart: Calendar.current.date(byAdding: .day, value: -90, to: Date()), end: nil)
            : nil
        return try await withCheckedThrowingContinuation { cont in
            let q = HKAnchoredObjectQuery(type: type, predicate: predicate, anchor: loadAnchor(key), limit: limit) { _, added, _, newAnchor, error in
                if let error { cont.resume(throwing: error) } else { cont.resume(returning: (added ?? [], newAnchor)) }
            }
            store.execute(q)
        }
    }

    private static func sleepValueName(_ v: Int) -> String {
        switch HKCategoryValueSleepAnalysis(rawValue: v) {
        case .inBed: "HKCategoryValueSleepAnalysisInBed"
        case .asleepUnspecified: "HKCategoryValueSleepAnalysisAsleepUnspecified"
        case .awake: "HKCategoryValueSleepAnalysisAwake"
        case .asleepCore: "HKCategoryValueSleepAnalysisAsleepCore"
        case .asleepDeep: "HKCategoryValueSleepAnalysisAsleepDeep"
        case .asleepREM: "HKCategoryValueSleepAnalysisAsleepREM"
        default: "HKCategoryValueSleepAnalysisAsleepUnspecified"
        }
    }

    private static func activityName(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .running: "Running"; case .walking: "Walking"; case .cycling: "Cycling"
        case .traditionalStrengthTraining: "TraditionalStrengthTraining"
        case .functionalStrengthTraining: "FunctionalStrengthTraining"
        case .highIntensityIntervalTraining: "HighIntensityIntervalTraining"
        case .swimming: "Swimming"; case .yoga: "Yoga"; case .hiking: "Hiking"
        case .rowing: "Rowing"; case .elliptical: "Elliptical"; case .stairClimbing: "StairClimbing"
        case .soccer: "Soccer"; case .basketball: "Basketball"; case .tennis: "Tennis"
        case .coreTraining: "CoreTraining"; case .pilates: "Pilates"; case .boxing: "Boxing"
        case .martialArts: "MartialArts"; case .dance: "Dance"; case .cooldown: "Cooldown"
        default: "Other(\(t.rawValue))"
        }
    }
}
