# Security

Sentience holds health records, test results and genetic markers, so it is locked down by default. **Settings → Security checkup** in the web app checks each item below against the running server and tells you what to fix.

## What protects what

| Threat | Protection |
|---|---|
| Someone on your Wi-Fi opens the web app | A password is required. On first start the server prints a one-time setup code; you need that code to set the password, so nobody else can claim a fresh install. Passwords are hashed with scrypt. |
| Password guessing | 5 failed logins per 15 minutes per address, then `429`. |
| Stolen session cookie | Cookies are `HttpOnly` (scripts can't read them), `SameSite=Strict`, and `Secure` over HTTPS. Only a SHA-256 hash of each session token is stored. Sessions expire after 30 days idle; Settings lists them and can revoke any. Changing the password signs everything else out. |
| Another website making your browser call the API | No CORS headers, `SameSite=Strict` cookies, and every cookie-authenticated write must carry an `X-Sentience: 1` header that cross-site forms can't add. |
| Injected scripts | Strict Content-Security-Policy (`script-src 'self'`), `X-Frame-Options: DENY`, `nosniff`, `no-referrer`. API responses are `no-store`. |
| The iPhone | Uses its own device token (`snt_…`), created under Settings → Devices, shown once, stored hashed on the server and in the Keychain on the phone. Revoke it if you lose the phone. |
| Someone steals the mini PC, copies the disk or a backup | **Password lock** (below): the database is encrypted with a key that is never stored, only wrapped by your password. The disk on its own is unreadable. The data folder is created mode `700`. |
| Traffic sniffed on the network | Use HTTPS (below). Plain HTTP on your own Wi-Fi is readable by anyone else on it. |
| AI features | Off unless you add an Anthropic API key. When on, only what you send for that one request leaves the server (a meal description or photo, or the export for the range you asked to assess). |
| GitHub | `.gitignore` blocks databases, key files, certificates, `.env`, genome raw files, Health exports and analysis bundles. |

## The password lock (how Apple's Advanced Data Protection works, for your own server)

New installs are locked with your password automatically. Older installs: **Settings → Data lock → Lock with my password**.

- A random 256-bit **data key** encrypts the whole database (ChaCha20-Poly1305 via SQLite3 Multiple Ciphers, with tamper detection on every page, WAL included).
- That key is never written down. `sentience.sqlite.vault.json` holds only **wrapped copies** of it (AES-256-GCM), one per thing you hold:
  - your **password**, through scrypt (N=2¹⁷, about 0.4 s and 128 MB per guess, so guessing is slow even with a GPU);
  - your **recovery key**, shown once at setup (24 characters, 120 random bits);
  - each **paired device token**, so your iPhone can unlock the server after a restart without you typing anything.
- When the server starts it is **locked**: it can't read a single record until one of those is presented. **Lock now** in Settings does the same on demand.
- Change your password and the password wrap is replaced. Revoke a device and its wrap is deleted, so it can't unlock any more.
- **Forgot the password?** "Use your recovery key" on the sign-in screen. Lose both and the data is gone for good: nobody, including whoever runs the server, can reset it. That's the point.

### What it protects, and what it doesn't

| | |
|---|---|
| Stolen or seized mini PC, powered off or restarted | Protected. |
| Copied disk, backup, cloud sync of the data folder | Protected. |
| Someone with a shell on the machine **while it's unlocked** | Not protected: the key is in the server's memory while it serves you, exactly as your iPhone's data is readable while it's unlocked. Lock it when you're away, keep the OS patched, and don't share the account. |
| Someone with your password, recovery key or an unrevoked device token | Not protected, by design. |

Apple's model goes one step further for iCloud: data is encrypted on your devices, so Apple's servers only ever see ciphertext. Here, "the host" is your own mini PC, and it has to read your data to work out insights, the explorer, imports and goals. Moving all of that into the browser and the iPhone would be the next step if you ever host Sentience on a machine you don't control (a VPS or cloud box); until then the password lock covers the realistic threats to a box in your home.

## Do these three things

### 1. Set the password and save the recovery key

Start the server and look for:

```
First run: open the app and enter this setup code to choose your password:

    XXXX-XXXX
```

Open the web app, enter the code and a password of 10+ characters. The code stops working once used. You're then shown your **recovery key** once: put it in your password manager or print it, not on the mini PC.

### 2. Older installs: lock with your password

Settings → **Data lock** → **Lock with my password**. The database is re-encrypted in place with a fresh key. If you used the key-file setup below, remove `SENTIENCE_DB_KEY_FILE` from the service afterwards and delete the old key file. Paired iPhones keep working: each one wraps its own copy the next time it syncs.

<details>
<summary>Older alternative: a key file</summary>

```bash
sudo systemctl stop sentience          # or stop npm start
npm run db:encrypt --workspace=server  # writes server/data/db.key (mode 600)
sudo mkdir -p /etc/sentience
sudo mv server/data/db.key /etc/sentience/db.key
sudo chown sentience:sentience /etc/sentience/db.key && sudo chmod 600 /etc/sentience/db.key
```

Then set `SENTIENCE_DB_KEY_FILE=/etc/sentience/db.key` (uncomment it in `deploy/sentience.service`) and start again. The whole database file is now encrypted with ChaCha20-Poly1305 (the default cipher of SQLite3 Multiple Ciphers), with tamper detection on every page. The server refuses to start with a missing or wrong key rather than creating an empty database.

Keep a copy of the key in your password manager. Without it the database cannot be opened, by you or anyone else.

Keeping the key on the same disk as the database protects copies of the database (backups, a file grabbed off the share) but not someone who has the whole disk. For that, also turn on full-disk encryption on the mini PC (LUKS on Linux, BitLocker on Windows, FileVault on macOS).

</details>

### 3. Use HTTPS

The easiest route is [Tailscale](https://tailscale.com): free for personal use, works away from home, and gives a real certificate.

```bash
# on the mini PC and the iPhone: install Tailscale and sign in
sudo tailscale serve --bg 4477
# prints https://<mini-pc>.<tailnet>.ts.net
```

Set `HOST=127.0.0.1` so the server is only reachable through Tailscale, then use the `https://…ts.net` address in the browser and in the iPhone app. Only devices signed into your tailnet can reach it.

Alternatively give the server a certificate directly with `SENTIENCE_TLS_CERT` and `SENTIENCE_TLS_KEY`.

**Do not port-forward 4477 on your router.**

## Backups

Copy `sentience.sqlite` **and** `sentience.sqlite.vault.json` together (with the server stopped, or straight after "Lock now"). The backup is unreadable without your password or recovery key, so it's safe to keep on a USB drive or in cloud storage. Restore by putting both files back.

## Checking it yourself

```bash
head -c 16 server/data/sentience.sqlite | xxd   # "SQLite format 3" means NOT encrypted
grep -c '"kind"' server/data/sentience.sqlite.vault.json   # wrapped keys only: password, recovery, devices
curl -i http://localhost:4477/api/profile        # 401 without a session
curl -sI http://localhost:4477/ | grep -i content-security-policy
```
