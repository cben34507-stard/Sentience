import SwiftUI

/// Same intro as the web app: braided strands sit around the wordmark, then
/// stretch out to the left and right edges before the app appears.
struct SplashView: View {
    var onDone: () -> Void
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()
    @State private var shown = 0
    @State private var tagline = false
    private let word = Array("Sentience")
    private let expandAt: Double = 2.0
    private let expandFor: Double = 1.0

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { tl in
            let t = tl.date.timeIntervalSince(start)
            let e = ease(min(1, max(0, (t - expandAt) / expandFor)))
            ZStack {
                Color(.systemBackground).ignoresSafeArea()
                StrandsCanvas(time: reduceMotion ? 0 : t, expand: e, dark: scheme == .dark)
                    .ignoresSafeArea()
                Ellipse()
                    .fill(RadialGradient(colors: [Color(.systemBackground), Color(.systemBackground).opacity(0)], center: .center, startRadius: 40, endRadius: 170))
                    .frame(width: 340, height: 150)
                    .opacity(1 - e)
                VStack(spacing: 10) {
                    HStack(spacing: 0) {
                        ForEach(word.indices, id: \.self) { i in
                            Text(String(word[i]))
                                .font(.system(size: 50, weight: .semibold))
                                .tracking(-2)
                                .offset(y: i < shown ? 0 : 36)
                                .opacity(i < shown ? 1 : 0)
                        }
                    }
                    .clipped()
                    Text("KNOW YOUR DAYS")
                        .font(.caption2.weight(.medium))
                        .tracking(4)
                        .foregroundStyle(.secondary)
                        .opacity(tagline ? 1 : 0)
                }
                .opacity(1 - e)
                .scaleEffect(1 + e * 0.06)
                .blur(radius: e * 6)
            }
        }
        .onAppear(perform: run)
    }

    private func ease(_ x: Double) -> Double { x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2 }

    private func run() {
        start = Date()
        for i in 0..<word.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2 + Double(i) * 0.05) {
                withAnimation(.spring(response: 0.7, dampingFraction: 0.85)) { shown = i + 1 }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { withAnimation(.easeOut(duration: 0.6)) { tagline = true } }
        DispatchQueue.main.asyncAfter(deadline: .now() + expandAt + expandFor + 0.1) { onDone() }
    }
}

/// Two twisting ribbons of thin lines.
struct StrandsCanvas: View {
    var time: Double
    /// 0 = bundled in the centre, 1 = stretched past both edges.
    var expand: Double
    var dark: Bool

    var body: some View {
        Canvas { gc, size in
            let w = size.width
            let h = size.height
            let span = w * (0.86 + (1.15 - 0.86) * expand)
            let amp = h * (0.11 + 0.1 * expand)
            let pinch = 1 - 0.85 * expand
            let cy = h / 2
            let x0 = w / 2 - span / 2
            let colors: [Color] = dark
                ? [Color(hex: 0x3FD1C0), Color(hex: 0xFF6F9A), Color(hex: 0xFFAD5C), Color(hex: 0x9B8CFF), Color(hex: 0x3FD1C0)]
                : [Color(hex: 0x14A394), Color(hex: 0xE2507A), Color(hex: 0xEE8A2F), Color(hex: 0x6D5BD8), Color(hex: 0x14A394)]
            let shading = GraphicsContext.Shading.linearGradient(Gradient(colors: colors), startPoint: CGPoint(x: x0, y: 0), endPoint: CGPoint(x: x0 + span, y: 0))
            let strands = 26
            let n = Int(span / 6)
            for r in 0..<2 {
                let dir: Double = r == 0 ? 1 : -1
                for i in 0..<strands {
                    let theta = Double(i) / Double(strands) * .pi
                    var path = Path()
                    for j in 0...n {
                        let s = Double(j) / Double(n)
                        let x = x0 + s * span
                        let knot = pow(sin(.pi * s), 0.85)
                        let env = (pinch * knot + (1 - pinch)) * (0.78 + 0.22 * sin(2 * .pi * 0.55 * s + time * 0.21 + Double(r)))
                        let phi = 2 * .pi * (1.15 * s + Double(r) * 0.5) + time * 0.5 * dir
                        let width = 0.55 + 0.45 * sin(2 * .pi * 0.8 * s - time * 0.33 + Double(r) * 2.1)
                        let drift = 0.32 * sin(2 * .pi * 0.42 * s + time * 0.23 + Double(r) * 1.3)
                        let y = cy + amp * env * (width * cos(theta + phi) * 0.92 + drift)
                        if j == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
                    }
                    var g = gc
                    g.opacity = (0.28 + 0.72 * abs(sin(theta + Double(r) * 0.7))) * (r == 0 ? 1 : 0.8)
                    g.stroke(path, with: shading, lineWidth: 0.8)
                }
            }
        }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}
