# Getting Sentience onto your iPhone

Apple only lets apps onto an iPhone through the App Store, TestFlight, or a build signed with your own developer account. Sentience is a personal app, so you sign it yourself.

**The catch is HealthKit.** Developers report that Xcode's free "Personal Team" signing refuses the HealthKit capability. Reading heart rate and writing test results both need it, so in practice you need the paid **Apple Developer Program** ($99 / £79 a year).

## Option 1 — Mac + Xcode + Developer Program (recommended)

You need a Mac (any Apple-silicon Mac, a borrowed one, or a cloud Mac) running a recent Xcode.

1. Join the Apple Developer Program at developer.apple.com/programs with your Apple ID. Approval usually takes a day or two.
2. On the Mac:
   ```bash
   brew install xcodegen
   git clone <this repo> && cd Sentience/ios
   xcodegen generate
   open Sentience.xcodeproj
   ```
3. In Xcode, select the **Sentience** target, then **Signing & Capabilities**. Tick *Automatically manage signing* and pick your team. If `app.sentience.ios` is taken, change the bundle ID to something like `com.yourname.sentience`.
4. Plug the iPhone in with a cable and tap **Trust** on the phone.
5. On the iPhone, open **Settings → Privacy & Security → Developer Mode**, turn it on, and restart.
6. In Xcode choose your iPhone as the run destination and press **Run**.

The install lasts a year before it needs re-signing. Rebuild and press Run whenever you pull new code.

### Install over the air with TestFlight

With the same membership you can skip the cable:

1. In Xcode: **Product → Archive**, then **Distribute App → TestFlight & App Store**.
2. In App Store Connect, add yourself as an internal tester.
3. Install **TestFlight** from the App Store on your iPhone and accept the invite.

Each TestFlight build lasts 90 days. Internal testing doesn't go through App Review.

## Option 2 — Mac + free Apple ID (not recommended)

Xcode will sign with a free Apple ID if you **remove the HealthKit capability**. The app then works for logging events, goals and test results, but it can't read or write Apple Health. Free builds also expire after 7 days. Use this only to try the app out.

## Option 3 — no Mac

- **GitHub Actions builds the app for you.** Every push that touches `ios/` runs the **iOS** workflow on a macOS runner. It compiles the app and uploads an unsigned `Sentience-unsigned.ipa` artifact (Actions tab → latest run → Artifacts). macOS minutes count 10x against a private repo's free allowance, so it only runs when the iOS code changes.
- **Sign and install that IPA from Windows or Linux** with Sideloadly or AltStore using your Apple ID. With a paid developer account they keep HealthKit. With a free Apple ID HealthKit is stripped and the app expires after 7 days, as in option 2.
- **Fully automated TestFlight from CI** is possible with a paid account by adding an App Store Connect API key to the repo's secrets and an upload step. Ask for it when you have the account.

## Option 4 — the web app, today, no install

The web app works in Safari on the phone. Open the server address (for example `http://192.168.1.20:4477`), tap **Share → Add to Home Screen**, and it opens full-screen like an app. It can log everything, but it can't touch Apple Health. Use Option 1 for that, or keep importing `export.zip` from the Health page.

## After it's installed

1. Start the server on the mini PC; it prints a `network http://192.168.x.x:4477` line.
2. In the app's **Sync** tab, paste that address and tap *Test connection*.
3. Turn on **Send Apple Health data** and **Write test results to Apple Health**, and allow the prompts.
4. Tap *Sync now*. From then on it syncs whenever you open the app at home.
