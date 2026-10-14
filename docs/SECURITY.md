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
| Someone copies the database file or the disk | Encrypt the database (below). The data folder is created mode `700`. |
| Traffic sniffed on the network | Use HTTPS (below). Plain HTTP on your own Wi-Fi is readable by anyone else on it. |
| AI features | Off unless you add an Anthropic API key. When on, only what you send for that one request leaves the server (a meal description or photo, or the export for the range you asked to assess). |
| GitHub | `.gitignore` blocks databases, key files, certificates, `.env`, genome raw files, Health exports and analysis bundles. |

## Do these three things

### 1. Set the password

Start the server and look for:

```
First run: open the app and enter this setup code to choose your password:

    XXXX-XXXX
```

Open the web app, enter the code and a password of 10+ characters. The code stops working once used.

### 2. Encrypt the database

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

Back up the database file and the key separately. With the server stopped (or using `sqlite3 .backup`), copy `sentience.sqlite`. An encrypted backup is useless to whoever finds it, and to you if you lose the key.

## Checking it yourself

```bash
head -c 16 server/data/sentience.sqlite | xxd   # "SQLite format 3" means NOT encrypted
curl -i http://localhost:4477/api/profile        # 401 without a session
curl -sI http://localhost:4477/ | grep -i content-security-policy
```
