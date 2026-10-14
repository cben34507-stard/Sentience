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

    /// Types Sentience may write test results into.
    static var writableTypes: Set<HKSampleType> {
        var set = Set<HKSampleType>()
        for p in LabPreset.all {
            if let raw = p.healthKitType, let t = HKObjectType.quantityType(forIdentifier: HKQuantityTypeIdentifier(rawValue: raw)) { set.insert(t) }
        }
        set.insert(HKCorrelationType(.bloodPressure))
        return set
    }

    func requestAuthorization(write: Bool = false) async throws {
        var read: Set<HKObjectType> = Set(quantityTypes.compactMap { HKObjectType.quantityType(forIdentifier: $0.0) })
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { read.insert(sleep) }
        read.insert(HKObjectType.workoutType())
        // Correlations can't be requested for sharing; their member types can.
        let share: Set<HKSampleType> = write ? Self.writableTypes.filter { !($0 is HKCorrelationType) } : []
        try await store.requestAuthorization(toShare: share, read: read)
    }

    /// Our own writes come back through anchored queries; never ship them as new health data.
    private static func isOwn(_ s: HKSample) -> Bool {
        if s.sourceRevision.source.bundleIdentifier == Bundle.main.bundleIdentifier { return true }
        if let id = s.metadata?[HKMetadataKeySyncIdentifier] as? String, id.hasPrefix("sentience-") { return true }
        return false
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
            for s in new.compactMap({ $0 as? HKQuantitySample }) where !Self.isOwn(s) {
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
            for s in new.compactMap({ $0 as? HKCategorySample }) where !Self.isOwn(s) {
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
        for w in newWorkouts.compactMap({ $0 as? HKWorkout }) where !Self.isOwn(w) {
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

    // MARK: - Writing test results

    enum WriteOutcome { case written, deleted, skipped, failed(String) }

    /// Writes (or replaces, or removes) one test result in Apple Health.
    /// HealthKit replaces a sample carrying the same HKMetadataKeySyncIdentifier
    /// when the new HKMetadataKeySyncVersion is higher, so re-syncing and editing
    /// never produce duplicates.
    func write(_ r: LocalLabResult, partner: LocalLabResult? = nil) async -> WriteOutcome {
        guard let preset = r.preset, let raw = preset.healthKitType, let unitString = preset.healthKitUnit else { return .skipped }
        let typeId = HKQuantityTypeIdentifier(rawValue: raw)
        let isBP = typeId == .bloodPressureSystolic || typeId == .bloodPressureDiastolic
        let syncId = isBP ? "sentience-bp-\(Int(r.takenAt.timeIntervalSince1970))" : "sentience-lab-\(r.id)"

        if r.deletedAt != nil || r.value == nil {
            do {
                try await deleteSamples(syncId: syncId, types: isBP ? [HKCorrelationType(.bloodPressure), HKQuantityType(.bloodPressureSystolic), HKQuantityType(.bloodPressureDiastolic)] : [HKQuantityType(typeId)])
                return .deleted
            } catch { return .failed(error.localizedDescription) }
        }

        let version = max(r.syncVersion, partner?.syncVersion ?? 0)
        let meta: [String: Any] = [
            HKMetadataKeySyncIdentifier: syncId,
            HKMetadataKeySyncVersion: version,
            HKMetadataKeyWasUserEntered: true,
            HKMetadataKeyExternalUUID: r.id,
        ]
        func quantity(_ id: HKQuantityTypeIdentifier, _ unit: String, _ value: Double) -> HKQuantitySample {
            // HealthKit stores percentages as fractions (0.97 for 97%).
            let v = unit == "%" ? value / 100 : value
            return HKQuantitySample(type: HKQuantityType(id), quantity: HKQuantity(unit: HKUnit(from: unit), doubleValue: v), start: r.takenAt, end: r.takenAt, metadata: meta)
        }

        do {
            if isBP, let partner, let pv = partner.value, let v = r.value {
                let (sys, dia) = typeId == .bloodPressureSystolic ? (v, pv) : (pv, v)
                let objects: Set<HKSample> = [quantity(.bloodPressureSystolic, "mmHg", sys), quantity(.bloodPressureDiastolic, "mmHg", dia)]
                let corr = HKCorrelation(type: HKCorrelationType(.bloodPressure), start: r.takenAt, end: r.takenAt, objects: objects, metadata: meta)
                try await store.save(corr)
            } else {
                try await store.save(quantity(typeId, unitString, r.value!))
            }
            return .written
        } catch {
            return .failed(error.localizedDescription)
        }
    }

    private func deleteSamples(syncId: String, types: [HKObjectType]) async throws {
        let predicate = HKQuery.predicateForObjects(withMetadataKey: HKMetadataKeySyncIdentifier, allowedValues: [syncId])
        for t in types {
            try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
                store.deleteObjects(of: t, predicate: predicate) { _, _, error in
                    if let error { cont.resume(throwing: error) } else { cont.resume() }
                }
            }
        }
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
