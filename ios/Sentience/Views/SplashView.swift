import SwiftUI

/// Same intro as the web app: letters rise in, a pulse line draws, then it lifts away.
struct SplashView: View {
    var onDone: () -> Void
    @State private var shown = 0
    @State private var trace: CGFloat = 0
    @State private var tagline = false
    private let word = Array("Sentience")

    var body: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()
            VStack(spacing: 18) {
                HStack(spacing: 0) {
                    ForEach(word.indices, id: \.self) { i in
                        Text(String(word[i]))
                            .font(.system(size: 54, weight: .semibold, design: .default))
                            .tracking(-2)
                            .offset(y: i < shown ? 0 : 40)
                            .opacity(i < shown ? 1 : 0)
                    }
                }
                .clipped()
                PulseLine()
                    .trim(from: 0, to: trace)
                    .stroke(Color.primary, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    .frame(width: 240, height: 40)
                Text("KNOW YOUR DAYS")
                    .font(.caption2.weight(.medium))
                    .tracking(4)
                    .foregroundStyle(.secondary)
                    .opacity(tagline ? 1 : 0)
                    .offset(y: tagline ? 0 : 6)
            }
        }
        .onAppear { run() }
    }

    private func run() {
        for i in 0..<word.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12 + Double(i) * 0.045) {
                withAnimation(.spring(response: 0.7, dampingFraction: 0.85)) { shown = i + 1 }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) {
            withAnimation(.easeInOut(duration: 1.1)) { trace = 1 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            withAnimation(.easeOut(duration: 0.6)) { tagline = true }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.1) { onDone() }
    }
}

struct PulseLine: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let y = r.midY
        p.move(to: CGPoint(x: r.minX, y: y))
        p.addLine(to: CGPoint(x: r.minX + r.width * 0.33, y: y))
        p.addLine(to: CGPoint(x: r.minX + r.width * 0.39, y: r.minY + r.height * 0.15))
        p.addLine(to: CGPoint(x: r.minX + r.width * 0.43, y: r.maxY - r.height * 0.05))
        p.addLine(to: CGPoint(x: r.minX + r.width * 0.46, y: r.minY + r.height * 0.3))
        p.addLine(to: CGPoint(x: r.minX + r.width * 0.48, y: y))
        p.addLine(to: CGPoint(x: r.maxX, y: y))
        return p
    }
}
