import SwiftUI
import SwiftData

struct EventEditorView: View {
    enum Mode { case create(EventDraft), edit(LocalEvent) }
    let mode: Mode

    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var sync: SyncService

    @State private var category: EventCategory = .note
    @State private var title = ""
    @State private var notes = ""
    @State private var startAt = Date()
    @State private var hasEnd = false
    @State private var endAt = Date()
    @State private var tags = ""
    @State private var hasRating = false
    @State private var rating = 7.0
    @State private var extras = ""

    private var isEdit: Bool { if case .edit = mode { return true }; return false }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(EventCategory.allCases) { c in
                                Button {
                                    category = c
                                    if title.isEmpty || EventCategory.allCases.map(\.label).contains(title) { title = c.label }
                                } label: {
                                    Label(c.label, systemImage: c.symbol)
                                        .font(.footnote.weight(.medium))
                                        .padding(.horizontal, 12).padding(.vertical, 8)
                                        .background(Capsule().fill(category == c ? Color.primary : Color.clear))
                                        .overlay(Capsule().strokeBorder(Color(.separator)))
                                        .foregroundStyle(category == c ? Color(.systemBackground) : .primary)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    TextField("What", text: $title)
                }
                Section("When") {
                    DatePicker("Start", selection: $startAt)
                    Toggle("Has an end", isOn: $hasEnd.animation())
                    if hasEnd { DatePicker("End", selection: $endAt, in: startAt...) }
                }
                Section("Details") {
                    TextField("Tags, comma separated", text: $tags)
                    Toggle("Rating", isOn: $hasRating.animation())
                    if hasRating {
                        HStack { Slider(value: $rating, in: 0...10, step: 1); Text("\(Int(rating))/10").monospacedDigit().frame(width: 44) }
                    }
                    TextField("Notes", text: $notes, axis: .vertical).lineLimit(2...6)
                    TextField("key: value, one per line (kcal: 620)", text: $extras, axis: .vertical).lineLimit(1...4).font(.footnote.monospaced())
                }
                if case let .edit(ev) = mode {
                    Section {
                        Button("Delete event", role: .destructive) {
                            ev.deletedAt = Date()
                            ev.touch()
                            try? ctx.save()
                            dismiss()
                            Task { await sync.syncIfPossible() }
                        }
                    }
                }
            }
            .navigationTitle(isEdit ? "Edit event" : "Log event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(isEdit ? "Save" : "Log it") { save() }.fontWeight(.semibold) }
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        switch mode {
        case let .create(d):
            category = d.category
            title = d.title
            startAt = d.startAt
            endAt = d.startAt.addingTimeInterval(3600)
            hasEnd = false
        case let .edit(e):
            category = e.category
            title = e.title
            notes = e.notes ?? ""
            startAt = e.startAt
            hasEnd = e.endAt != nil
            endAt = e.endAt ?? e.startAt.addingTimeInterval(3600)
            tags = e.tags.joined(separator: ", ")
            hasRating = e.rating != nil
            rating = e.rating ?? 7
            extras = e.data.map { "\($0.key): \($0.value)" }.sorted().joined(separator: "\n")
        }
    }

    private func parsedExtras() -> [String: Any] {
        var out: [String: Any] = [:]
        for line in extras.split(separator: "\n") {
            let parts = line.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            guard parts.count == 2, !parts[0].isEmpty else { continue }
            out[parts[0]] = Double(parts[1]).map { $0 == $0.rounded() ? Int($0) as Any : $0 as Any } ?? parts[1]
        }
        return out
    }

    private func save() {
        let tagList = tags.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let finalTitle = title.trimmingCharacters(in: .whitespaces).isEmpty ? category.label : title
        switch mode {
        case .create:
            let e = LocalEvent(category: category, title: finalTitle, notes: notes.isEmpty ? nil : notes, startAt: startAt, endAt: hasEnd ? endAt : nil, tags: tagList, rating: hasRating ? rating : nil, data: parsedExtras())
            ctx.insert(e)
        case let .edit(e):
            e.category = category
            e.title = finalTitle
            e.notes = notes.isEmpty ? nil : notes
            e.startAt = startAt
            e.endAt = hasEnd ? endAt : nil
            e.tags = tagList
            e.rating = hasRating ? rating : nil
            e.data = parsedExtras()
            e.touch()
        }
        try? ctx.save()
        dismiss()
        Task { await sync.syncIfPossible() }
    }
}
