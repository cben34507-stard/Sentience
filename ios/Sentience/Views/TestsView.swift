import SwiftUI
import SwiftData

struct TestsView: View {
    @Query(filter: #Predicate<LocalLabResult> { $0.deletedAt == nil }, sort: \LocalLabResult.takenAt, order: .reverse) private var results: [LocalLabResult]
    @EnvironmentObject private var sync: SyncService
    @State private var adding = false
    @State private var editing: LocalLabResult?

    private var grouped: [(String, [LocalLabResult])] {
        // Latest result per test, grouped by panel.
        var latest: [String: LocalLabResult] = [:]
        for r in results where latest[r.testKey == "custom" ? r.name : r.testKey] == nil {
            latest[r.testKey == "custom" ? r.name : r.testKey] = r
        }
        let byPanel = Dictionary(grouping: latest.values, by: \.panel)
        return byPanel.keys.sorted().map { ($0, byPanel[$0]!.sorted { $0.name < $1.name }) }
    }

    var body: some View {
        NavigationStack {
            List {
                if results.isEmpty {
                    ContentUnavailableView("No test results yet", systemImage: "flask", description: Text("Add bloods or clinic measurements. Results Apple Health has a place for are written there too."))
                }
                ForEach(grouped, id: \.0) { panel, rows in
                    Section(panel) {
                        ForEach(rows) { r in
                            NavigationLink {
                                TestHistoryView(testKey: r.testKey, name: r.name, onEdit: { editing = $0 })
                            } label: {
                                LabRow(result: r, count: results.filter { $0.testKey == r.testKey && $0.name == r.name }.count)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Tests")
            .toolbar { Button { adding = true } label: { Image(systemName: "plus") } }
            .sheet(isPresented: $adding) { LabEditorView(result: nil) }
            .sheet(item: $editing) { LabEditorView(result: $0) }
            .refreshable { await sync.sync() }
        }
    }
}

struct LabRow: View {
    let result: LocalLabResult
    var count: Int = 1

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(result.name).font(.body.weight(.medium))
                    if result.preset?.healthKitType != nil {
                        Image(systemName: result.healthKitVersion >= result.syncVersion ? "heart.fill" : "heart")
                            .font(.caption2).foregroundStyle(.secondary)
                            .accessibilityLabel(result.healthKitVersion >= result.syncVersion ? "In Apple Health" : "Not yet in Apple Health")
                    }
                }
                Text("\(result.takenAt.formatted(date: .abbreviated, time: .omitted)) · \(count) result\(count == 1 ? "" : "s")")
                    .font(.caption).foregroundStyle(.secondary)
                if let err = result.healthKitError { Text(err).font(.caption2).foregroundStyle(.red).lineLimit(2) }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(result.value.map { $0.formatted(.number.precision(.fractionLength(0...2))) } ?? result.valueText ?? "—")
                    .font(.body.weight(.semibold).monospacedDigit())
                + Text(" \(result.unit)").font(.caption).foregroundColor(.secondary)
                FlagBadge(flag: result.flag)
            }
        }
    }
}

struct FlagBadge: View {
    let flag: LocalLabResult.Flag
    var body: some View {
        switch flag {
        case .unknown: EmptyView()
        case .normal: badge("In range", .green)
        case .low: badge("Low", .orange)
        case .high: badge("High", .orange)
        }
    }
    private func badge(_ t: String, _ c: Color) -> some View {
        Text(t.uppercased()).font(.caption2.weight(.semibold)).padding(.horizontal, 6).padding(.vertical, 2)
            .background(Capsule().fill(c.opacity(0.15))).foregroundStyle(c)
    }
}

struct TestHistoryView: View {
    let testKey: String
    let name: String
    var onEdit: (LocalLabResult) -> Void
    @Query private var rows: [LocalLabResult]

    init(testKey: String, name: String, onEdit: @escaping (LocalLabResult) -> Void) {
        self.testKey = testKey
        self.name = name
        self.onEdit = onEdit
        _rows = Query(filter: #Predicate<LocalLabResult> { $0.testKey == testKey && $0.name == name && $0.deletedAt == nil }, sort: \.takenAt, order: .reverse)
    }

    var body: some View {
        List {
            ForEach(rows) { r in
                Button { onEdit(r) } label: { LabRow(result: r) }.buttonStyle(.plain)
            }
            if let r = rows.first, r.refLow != nil || r.refHigh != nil {
                Section { Text("Range on latest report: \(r.refLow.map { "\($0.formatted())" } ?? "") – \(r.refHigh.map { "\($0.formatted())" } ?? "") \(r.unit)").font(.footnote).foregroundStyle(.secondary) }
            }
        }
        .navigationTitle(name)
    }
}

struct LabEditorView: View {
    let result: LocalLabResult?
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var sync: SyncService

    @State private var presetKey = ""
    @State private var customName = ""
    @State private var value = ""
    @State private var unit = ""
    @State private var refLow = ""
    @State private var refHigh = ""
    @State private var takenAt = Date()
    @State private var lab = ""
    @State private var notes = ""
    @State private var duplicate = false

    private var preset: LabPreset? { LabPreset.byKey[presetKey] }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Test", selection: $presetKey) {
                        Text("Choose…").tag("")
                        ForEach(LabPreset.panels, id: \.self) { panel in
                            Section(panel) {
                                ForEach(LabPreset.all.filter { $0.panel == panel }) { p in
                                    Label(p.name, systemImage: p.healthKitType != nil ? "heart" : "flask").tag(p.key)
                                }
                            }
                        }
                        Text("Other test…").tag("custom")
                    }
                    .pickerStyle(.navigationLink)
                    .onChange(of: presetKey) { _, k in
                        guard result == nil, let p = LabPreset.byKey[k] else { return }
                        unit = p.unit
                        refLow = p.refLow.map { "\($0.formatted())" } ?? ""
                        refHigh = p.refHigh.map { "\($0.formatted())" } ?? ""
                    }
                    if presetKey == "custom" { TextField("Test name", text: $customName) }
                    if preset?.healthKitType != nil {
                        Label("Shares to Apple Health", systemImage: "heart").font(.footnote).foregroundStyle(.secondary)
                    }
                }
                Section("Result") {
                    HStack {
                        TextField("Value", text: $value).keyboardType(.decimalPad)
                        TextField("Unit", text: $unit).multilineTextAlignment(.trailing).foregroundStyle(.secondary)
                    }
                    HStack {
                        TextField("Range low", text: $refLow).keyboardType(.decimalPad)
                        TextField("Range high", text: $refHigh).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                    DatePicker("Taken", selection: $takenAt)
                    TextField("Where (GP, hospital, lab)", text: $lab)
                    TextField("Notes", text: $notes, axis: .vertical).lineLimit(1...4)
                }
                if duplicate {
                    Section { Label("This exact result is already recorded.", systemImage: "exclamationmark.triangle").foregroundStyle(.orange) }
                }
                if let result {
                    Section {
                        Button("Delete result", role: .destructive) {
                            result.deletedAt = Date()
                            result.touch()
                            try? ctx.save()
                            dismiss()
                            Task { await sync.writePendingLabsToHealth(); await sync.syncIfPossible() }
                        }
                    }
                }
            }
            .navigationTitle(result == nil ? "Add result" : "Edit result")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.disabled(presetKey.isEmpty || value.isEmpty) }
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard let r = result else { return }
        presetKey = r.testKey
        customName = r.testKey == "custom" ? r.name : ""
        value = r.value.map { "\($0.formatted())" } ?? r.valueText ?? ""
        unit = r.unit
        refLow = r.refLow.map { "\($0.formatted())" } ?? ""
        refHigh = r.refHigh.map { "\($0.formatted())" } ?? ""
        takenAt = r.takenAt
        lab = r.lab
        notes = r.notes
    }

    private func num(_ s: String) -> Double? { Double(s.replacingOccurrences(of: ",", with: ".")) }

    private func save() {
        let name = presetKey == "custom" ? (customName.isEmpty ? "Custom test" : customName) : (preset?.name ?? customName)
        let v = num(value)
        if let r = result {
            r.testKey = presetKey
            r.name = name
            r.value = v
            r.valueText = v == nil ? value : nil
            r.unit = unit
            r.refLow = num(refLow)
            r.refHigh = num(refHigh)
            r.takenAt = takenAt
            r.lab = lab
            r.notes = notes
            r.touch()
        } else {
            // Same test at the same minute with the same value: don't store it twice.
            let key = presetKey
            let existing = (try? ctx.fetch(FetchDescriptor<LocalLabResult>(predicate: #Predicate { $0.testKey == key && $0.deletedAt == nil }))) ?? []
            if existing.contains(where: { abs($0.takenAt.timeIntervalSince(takenAt)) < 60 && $0.value == v && $0.name == name }) {
                duplicate = true
                return
            }
            ctx.insert(LocalLabResult(preset: preset, name: name, value: v, valueText: v == nil ? value : nil, unit: unit, refLow: num(refLow), refHigh: num(refHigh), takenAt: takenAt, lab: lab, notes: notes))
        }
        try? ctx.save()
        dismiss()
        Task { await sync.writePendingLabsToHealth(); await sync.syncIfPossible() }
    }
}
