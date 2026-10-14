import { motion } from "framer-motion";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KeyRound, LockKeyhole, ShieldAlert, Terminal } from "lucide-react";
import { api } from "../lib/api";
import { Field, Spinner } from "./ui";
import { Logo } from "./Shell";

type State = { kind: "loading" } | { kind: "setup" } | { kind: "login" } | { kind: "ok" } | { kind: "offline"; message: string };

/** Shows setup or sign-in until the server says this browser has a session. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const check = useCallback(async () => {
    try {
      const s = await api.auth.status();
      setState(!s.configured ? { kind: "setup" } : s.authenticated ? { kind: "ok" } : { kind: "login" });
    } catch (e) {
      setState({ kind: "offline", message: e instanceof Error ? e.message : "Server unreachable" });
    }
  }, []);
  useEffect(() => {
    void check();
    const h = () => setState({ kind: "login" });
    window.addEventListener("sentience:unauthorized", h);
    return () => window.removeEventListener("sentience:unauthorized", h);
  }, [check]);

  if (state.kind === "ok") return <>{children}</>;
  return (
    <div className="relative z-10 grid min-h-full place-items-center px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="card w-full max-w-sm p-7">
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
        {state.kind === "setup" && <Setup onDone={check} />}
        {state.kind === "login" && <Login onDone={check} />}
      </motion.div>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
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
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-3">Sign in to your Sentience server.</p>
      </div>
      <Field label="Password">
        <input className="field" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus required />
      </Field>
      {err && <div className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
      <button className="btn-primary w-full" disabled={busy || !pw}>
        {busy ? <Spinner className="border-paper/40 border-t-paper" /> : <LockKeyhole className="h-4 w-4" />} Sign in
      </button>
    </form>
  );
}

function Setup({ onDone }: { onDone: () => void }) {
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
          await api.auth.setup(code, pw);
          onDone();
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Setup failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Secure your server</h1>
        <p className="mt-1 text-sm text-ink-3">Choose the password that protects all of your data.</p>
      </div>
      <div className="flex gap-2.5 rounded-xl bg-paper-2 p-3 text-xs text-ink-2">
        <Terminal className="mt-0.5 h-4 w-4 shrink-0" />
        <span>The server printed a setup code when it started. It proves you're the person with access to the mini PC.</span>
      </div>
      <Field label="Setup code">
        <input className="field font-mono tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123-456" autoFocus required />
      </Field>
      <Field label="Password" hint="At least 10 characters">
        <input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </Field>
      <Field label="Confirm password">
        <input className="field" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
      </Field>
      {err && <div className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? <Spinner className="border-paper/40 border-t-paper" /> : <KeyRound className="h-4 w-4" />} Set password
      </button>
    </form>
  );
}
