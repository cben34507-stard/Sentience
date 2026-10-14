import SwiftUI
import SwiftData

struct TodayView: View {
    @Environment(\.modelContext) private var ctx
    @EnvironmentObject private var sync: SyncService
    @State private var date = Date()
    @State private var editing: LocalEvent?
    @State private var creating: EventDraft?

    private var dayStart: Date { Calendar.current.startOfDay(for: date) }
    private var dayEnd: Date { Calendar.current.date(byAdding: .day, value: 1, to: dayStart)! }

    var body: some View {
        NavigationStack {
            DayList(start: dayStart, end: dayEnd, onTap: { editing = $0 })
                .safeAreaInset(edge: .top) { quickChips }
                .navigationTitle(Self.title(for: date))
                .navigationBarTitleDisplayMode(.large)
                .toolbar {
                    ToolbarItemGroup(placement: .topBarLeading) {
                        Button { shift(-1) } label: { Image(systemName: "chevron.left") }
                        Button { shift(1) } label: { Image(systemName: "chevron.right") }
                            .disabled(Calendar.current.isDateInToday(date))
                    }
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        if sync.isSyncing { ProgressView() }
                        Button { creating = EventDraft(startAt: defaultStart()) } label: { Image(systemName: "plus.circle.fill").font(.title2) }
                    }
                }
                .sheet(item: $editing) { ev in EventEditorView(mode: .edit(ev)) }
                .sheet(item: $creating) { d in EventEditorView(mode: .create(d)) }
                .refreshable { await sync.sync() }
        }
    }

    private var quickChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(QuickAction.all) { q in
                    Button {
                        creating = EventDraft(category: q.category, title: q.title, startAt: defaultStart())
                    } label: {
                        Label(q.label, systemImage: q.icon)
                            .font(.footnote.weight(.medium))
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(Capsule().strokeBorder(Color(.separator)))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(.bar)
    }

    private func shift(_ n: Int) { date = Calendar.current.date(byAdding: .day, value: n, to: date) ?? date }

    private func defaultStart() -> Date {
        Calendar.current.isDateInToday(date) ? Date() : Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: date) ?? date
    }

    static func title(for d: Date) -> String {
        if Calendar.current.isDateInToday(d) { return "Today" }
        if Calendar.current.isDateInYesterday(d) { return "Yesterday" }
        return d.formatted(.dateTime.weekday(.wide).day().month(.abbreviated))
    }
}

/// Separate view so the @Query predicate can be built from the chosen day.
struct DayList: View {
    @Query private var events: [LocalEvent]
    var onTap: (LocalEvent) -> Void

    init(start: Date, end: Date, onTap: @escaping (LocalEvent) -> Void) {
        _events = Query(filter: #Predicate<LocalEvent> { $0.startAt >= start && $0.startAt < end && $0.deletedAt == nil }, sort: \.startAt)
        self.onTap = onTap
    }

    var body: some View {
        List {
            if events.isEmpty {
                ContentUnavailableView("Nothing logged yet", systemImage: "sparkles", description: Text("Tap a chip above or the + button. Everything syncs to your server when you're home."))
                    .listRowSeparator(.hidden)
            }
            ForEach(events) { e in
                Button { onTap(e) } label: { EventRow(event: e) }
                    .buttonStyle(.plain)
            }
        }
        .listStyle(.plain)
    }
}

struct EventRow: View {
    let event: LocalEvent
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(event.startAt.formatted(date: .omitted, time: .shortened))
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: 48, alignment: .trailing)
                .padding(.top, 3)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Image(systemName: event.category.symbol).foregroundStyle(.secondary).frame(width: 18)
                    Text(event.title).font(.body.weight(.medium))
                    if let r = event.rating {
                        Text("\(Int(r))/10").font(.caption2.weight(.semibold)).padding(.horizontal, 6).padding(.vertical, 2).background(Capsule().fill(Color(.tertiarySystemFill)))
                    }
                    if event.dirty { Image(systemName: "arrow.up.circle").font(.caption).foregroundStyle(.tertiary) }
                }
                HStack(spacing: 4) {
                    Text(event.category.label)
                    if let end = event.endAt { Text("· → \(end.formatted(date: .omitted, time: .shortened))") }
                    if !event.tags.isEmpty { Text("· " + event.tags.joined(separator: ", ")) }
                }
                .font(.caption).foregroundStyle(.secondary)
                if let n = event.notes, !n.isEmpty { Text(n).font(.subheadline).foregroundStyle(.secondary).lineLimit(3) }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
    }
}

struct QuickAction: Identifiable {
    let label: String
    let category: EventCategory
    let title: String
    let icon: String
    var id: String { label }

    static let all: [QuickAction] = [
        .init(label: "Woke up", category: .wake, title: "Woke up", icon: "alarm"),
        .init(label: "Teeth", category: .hygiene, title: "Brushed teeth", icon: "sparkles"),
        .init(label: "Breakfast", category: .meal, title: "Breakfast", icon: "cup.and.saucer"),
        .init(label: "Vitamins", category: .supplement, title: "Vitamins", icon: "pills"),
        .init(label: "Coffee", category: .drink, title: "Coffee", icon: "mug"),
        .init(label: "Water", category: .drink, title: "Water", icon: "drop"),
        .init(label: "Left house", category: .movement, title: "Left the house", icon: "door.left.hand.open"),
        .init(label: "Back home", category: .movement, title: "Got back home", icon: "house"),
        .init(label: "Lunch", category: .meal, title: "Lunch", icon: "takeoutbag.and.cup.and.straw"),
        .init(label: "Dinner", category: .meal, title: "Dinner", icon: "fork.knife"),
        .init(label: "Workout", category: .workout, title: "Workout", icon: "dumbbell"),
        .init(label: "Mood", category: .mood, title: "Mood check", icon: "brain.head.profile"),
        .init(label: "Bed", category: .sleep, title: "Went to bed", icon: "bed.double"),
    ]
}

struct EventDraft: Identifiable {
    var id = UUID()
    var category: EventCategory = .note
    var title: String = ""
    var startAt: Date
}
