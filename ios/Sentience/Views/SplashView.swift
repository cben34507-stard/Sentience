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
            let w: Double = size.width
            let h: Double = size.height
            let span: Double = w * (0.86 + 0.29 * expand)
            let amp: Double = h * (0.11 + 0.1 * expand)
            let pinch: Double = 1 - 0.85 * expand
            let cy: Double = h / 2
            let x0: Double = w / 2 - span / 2
            let colors: [Color] = dark
                ? [Color(hex: 0x3FD1C0), Color(hex: 0xFF6F9A), Color(hex: 0xFFAD5C), Color(hex: 0x9B8CFF), Color(hex: 0x3FD1C0)]
                : [Color(hex: 0x14A394), Color(hex: 0xE2507A), Color(hex: 0xEE8A2F), Color(hex: 0x6D5BD8), Color(hex: 0x14A394)]
            let shading = GraphicsContext.Shading.linearGradient(Gradient(colors: colors), startPoint: CGPoint(x: x0, y: 0), endPoint: CGPoint(x: x0 + span, y: 0))
            let strands = 26
            let n = Int(span / 6)
            for r in 0..<2 {
                let dir: Double = r == 0 ? 1 : -1
                for i in 0..<strands {
                    let theta: Double = Double(i) / Double(strands) * Double.pi
                    var path = Path()
                    for j in 0...n {
                        let sv: Double = Double(j) / Double(n)
                        let x: Double = x0 + sv * span
                        let y: Double = Self.strandY(s: sv, theta: theta, ribbon: Double(r), dir: dir, time: time, cy: cy, amp: amp, pinch: pinch)
                        if j == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
                    }
                    var g = gc
                    let depth: Double = 0.28 + 0.72 * abs(sin(theta + Double(r) * 0.7))
                    g.opacity = depth * (r == 0 ? 1.0 : 0.8)
                    g.stroke(path, with: shading, lineWidth: 0.8)
                }
            }
        }
    }
}

extension StrandsCanvas {
    /// Vertical position of one strand at fraction `s` across the bundle.
    /// Split into typed steps so the Swift type checker stays fast.
    static func strandY(s: Double, theta: Double, ribbon r: Double, dir: Double, time: Double, cy: Double, amp: Double, pinch: Double) -> Double {
        let twoPi: Double = 2 * Double.pi
        let knot: Double = pow(sin(Double.pi * s), 0.85)
        let wobble: Double = 0.78 + 0.22 * sin(twoPi * 0.55 * s + time * 0.21 + r)
        let env: Double = (pinch * knot + (1 - pinch)) * wobble
        let phi: Double = twoPi * (1.15 * s + r * 0.5) + time * 0.5 * dir
        let width: Double = 0.55 + 0.45 * sin(twoPi * 0.8 * s - time * 0.33 + r * 2.1)
        let drift: Double = 0.32 * sin(twoPi * 0.42 * s + time * 0.23 + r * 1.3)
        let twist: Double = width * cos(theta + phi) * 0.92
        return cy + amp * env * (twist + drift)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}
