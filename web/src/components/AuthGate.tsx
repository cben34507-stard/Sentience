import { motion } from "framer-motion";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Download, KeyRound, LifeBuoy, LockKeyhole, ShieldAlert, ShieldCheck, Terminal } from "lucide-react";
import { api } from "../lib/api";
import { Field, Spinner } from "./ui";
import { Logo } from "./Shell";

type State =
  | { kind: "loading" }
  | { kind: "setup"; vault: boolean }
  | { kind: "login"; locked: boolean }
  | { kind: "recover" }
  | { kind: "recovery-key"; key: string }
  | { kind: "ok" }
  | { kind: "offline"; message: string };

/** Shows setup, unlock or sign-in until the server says this browser has a session. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const check = useCallback(async () => {
    try {
      const s = await api.auth.status();
      setState(!s.configured ? { kind: "setup", vault: s.vault } : s.authenticated ? { kind: "ok" } : { kind: "login", locked: s.locked });
    } catch (e) {
      setState({ kind: "offline", message: e instanceof Error ? e.message : "Server unreachable" });
    }
  }, []);
  useEffect(() => {
    void check();
    const h = () => void check();
    window.addEventListener("sentience:unauthorized", h);
    return () => window.removeEventListener("sentience:unauthorized", h);
  }, [check]);

  if (state.kind === "ok") return <>{children}</>;
  return (
    <div className="relative z-10 grid min-h-full place-items-center px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className={`card w-full p-7 ${state.kind === "recovery-key" ? "max-w-md" : "max-w-sm"}`}>
        <div className="mb-6 flex items-center gap-2">
          <Logo />
          <span className="text-lg font-semibold tracking-[-0.03em]">Sentience</span>
        </div>
        {state.kind === "loading" && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {state.kind === "offline" && (
          <div className="flex gap-3 text-sm text-ink-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-warn" /> Can't reach the server ({state.message}). Is it running?
          </div>
        )}
        {state.kind === "setup" && <Setup vault={state.vault} onDone={(key) => (key ? setState({ kind: "recovery-key", key }) : void check())} />}
        {state.kind === "login" && <Login locked={state.locked} onDone={check} onForgot={() => setState({ kind: "recover" })} />}
        {state.kind === "recover" && <Recover onDone={check} onBack={() => void check()} />}
        {state.kind === "recovery-key" && <RecoveryKeyNotice recoveryKey={state.key} onDone={check} />}
      </motion.div>
    </div>
  );
}

const ErrorBox = ({ err }: { err: string | null }) => (err ? <div className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div> : null);

function Login({ locked, onDone, onForgot }: { locked: boolean; onDone: () => void; onForgot: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api.auth.login(pw);
          onDone();
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Sign-in failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{locked ? "Sentience is locked" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-ink-3">
          {locked ? "Your data is encrypted and the server can't read it until you unlock it with your password." : "Sign in to your Sentience server."}
        </p>
      </div>
      <Field label="Password">
        <input className="field" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus required />
      </Field>
      <ErrorBox err={err} />
      <button className="btn-primary w-full" disabled={busy || !pw}>
        {busy ? <Spinner className="border-paper/40 border-t-paper" /> : <LockKeyhole className="h-4 w-4" />} {locked ? "Unlock" : "Sign in"}
      </button>
      {locked && (
        <button type="button" className="btn-ghost w-full text-sm" onClick={onForgot}>
          <LifeBuoy className="h-4 w-4" /> Forgot it? Use your recovery key
        </button>
      )}
    </form>
  );
}

function Recover({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [key, setKey] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pw !== pw2) return setErr("Passwords don't match.");
        if (pw.length < 10) return setErr("Use at least 10 characters.");
        setBusy(true);
        setErr(null);
        try {
          await api.auth.recover(key, pw);
          onDone();
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Recovery failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Use your recovery key</h1>
        <p className="mt-1 text-sm text-ink-3">The 24-character key you saved at setup. It unlocks your data and lets you choose a new password.</p>
      </div>
      <Field label="Recovery key">
        <input className="field font-mono uppercase tracking-wider" value={key} onChange={(e) => setKey(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autoFocus required />
      </Field>
      <Field label="New password" hint="At least 10 characters">
        <input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </Field>
      <Field label="Confirm new password">
        <input className="field" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
      </Field>
      <ErrorBox err={err} />
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? <Spinner className="border-paper/40 border-t-paper" /> : <KeyRound className="h-4 w-4" />} Unlock and set password
      </button>
      <button type="button" className="btn-ghost w-full text-sm" onClick={onBack}>
        Back
      </button>
    </form>
  );
}

function Setup({ vault, onDone }: { vault: boolean; onDone: (recoveryKey?: string) => void }) {
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pw !== pw2) return setErr("Passwords don't match.");
        if (pw.length < 10) return setErr("Use at least 10 characters. A short phrase works well.");
        setBusy(true);
        setErr(null);
        try {
          const res = await api.auth.setup(code, pw);
          onDone(res.recoveryKey);
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Setup failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Secure your server</h1>
        <p className="mt-1 text-sm text-ink-3">
          {vault ? "Your password becomes the key to your data: without it the database can't be read, not even by the server it lives on." : "Choose the password that protects all of your data."}
        </p>
      </div>
      <div className="flex gap-2.5 rounded-xl bg-paper-2 p-3 text-xs text-ink-2">
        <Terminal className="mt-0.5 h-4 w-4 shrink-0" />
        <span>The server printed a setup code when it started. It proves you're the person with access to the mini PC.</span>
      </div>
      <Field label="Setup code">
        <input className="field font-mono tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123-456" autoFocus required />
      </Field>
      <Field label="Password" hint="At least 10 characters. A few random words is strong and memorable.">
        <input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </Field>
      <Field label="Confirm password">
        <input className="field" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
      </Field>
      <ErrorBox err={err} />
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? <Spinner className="border-paper/40 border-t-paper" /> : <KeyRound className="h-4 w-4" />} Set password
      </button>
    </form>
  );
}

/** Shown once, straight after the key is made. Also used from Settings. */
export function RecoveryKeyNotice({ recoveryKey, onDone, doneLabel = "I've saved it, continue" }: { recoveryKey: string; onDone: () => void; doneLabel?: string }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const download = () => {
    const text = `Sentience recovery key\n\n${recoveryKey}\n\nKeep this somewhere safe and offline (a password manager or printed). It unlocks your data if you forget your password. Anyone with it and access to your server can read your data.\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "sentience-recovery-key.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ShieldCheck className="h-5 w-5" /> Save your recovery key
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Your data is now locked with your password. If you ever forget it, this key is the only way back in. Nobody can reset it for you: that's the point.
        </p>
      </div>
      <div className="overflow-x-auto whitespace-nowrap rounded-2xl border border-line bg-paper-2 px-3 py-4 text-center font-mono text-[15px] font-semibold tracking-[0.06em] select-all sm:text-base">{recoveryKey}</div>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-ghost flex-1 border border-line"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(recoveryKey);
              setCopied(true);
            } catch {
              /* clipboard needs HTTPS; the key is selectable anyway */
            }
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="btn-ghost flex-1 border border-line" onClick={download}>
          <Download className="h-4 w-4" /> Download
        </button>
      </div>
      <p className="text-xs text-ink-3">Put it in your password manager or print it. Don't keep it on the mini PC itself.</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I've stored the recovery key somewhere safe.
      </label>
      <button className="btn-primary w-full" disabled={!saved} onClick={onDone}>
        {doneLabel}
      </button>
    </div>
  );
}
