import { useCallback, useEffect, useState } from "react";
import { CircleCheck, CircleHelp, Copy, KeyRound, LogOut, Monitor, Plus, ShieldAlert, Smartphone, Sparkles, Trash2 } from "lucide-react";
import { api, type CheckupItem, type SessionRow } from "../lib/api";
import { Card, Field, Modal, PageTitle, SectionTitle, Spinner, useToast } from "../components/ui";

export function Settings() {
  const [checkup, setCheckup] = useState<CheckupItem[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [ai, setAi] = useState<{ enabled: boolean; source: "env" | "settings" | null; model: string } | null>(null);
  const [newDevice, setNewDevice] = useState<{ open: boolean; name: string; token?: string }>({ open: false, name: "" });
  const toast = useToast();

  const load = useCallback(async () => {
    const [c, s, a] = await Promise.all([api.checkup(), api.auth.sessions(), api.ai.status()]);
    setCheckup(c.items);
    setSessions(s);
    setAi(a);
  }, []);
  useEffect(() => {
    load().catch((e) => toast(e.message, "err"));
  }, [load, toast]);

  const score = checkup ? `${checkup.filter((i) => i.ok === true).length} of ${checkup.filter((i) => i.ok !== null).length}` : "";

  return (
    <div>
      <PageTitle
        title="Settings"
        subtitle="Security, devices and optional AI features."
        actions={
          <button
            className="btn-ghost"
            onClick={async () => {
              await api.auth.logout();
              window.location.reload();
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle aside={checkup && <span className="text-xs text-ink-3">{score} checks passing</span>}>Security checkup</SectionTitle>
            {!checkup ? (
              <Spinner />
            ) : (
              <ul className="divide-y divide-line">
                {checkup.map((i) => {
                  const Icon = i.ok === true ? CircleCheck : i.ok === false ? ShieldAlert : CircleHelp;
                  return (
                    <li key={i.id} className="flex gap-3 py-3">
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${i.ok === true ? "text-good" : i.ok === false ? "text-warn" : "text-ink-3"}`} strokeWidth={1.8} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{i.title}</div>
                        <div className="text-sm text-ink-2">{i.detail}</div>
                        {i.ok !== true && i.fix && <div className="mt-1.5 rounded-lg bg-paper-2 px-2.5 py-1.5 font-mono text-[11px] text-ink-2">{i.fix}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle
              aside={
                <button className="btn-primary h-8 px-3 text-xs" onClick={() => setNewDevice({ open: true, name: "iPhone" })}>
                  <Plus className="h-3.5 w-3.5" /> Add device
                </button>
              }
            >
              Signed-in browsers and devices
            </SectionTitle>
            <ul className="divide-y divide-line">
              {sessions.map((s) => {
                const Icon = s.kind === "device" ? Smartphone : Monitor;
                return (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <Icon className="h-5 w-5 shrink-0 text-ink-2" strokeWidth={1.8} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {s.name || (s.kind === "device" ? "Device" : "Browser")} {s.current && <span className="ml-1 rounded-full bg-paper-3 px-2 py-0.5 text-[10px] font-semibold">this browser</span>}
                      </div>
                      <div className="truncate text-xs text-ink-3">
                        Last used {new Date(s.lastUsedAt).toLocaleString()} {s.ip ? `· ${s.ip}` : ""} {s.userAgent ? `· ${s.userAgent.slice(0, 60)}` : ""}
                      </div>
                    </div>
                    <button
                      className="btn-ghost h-8 w-8 p-0 text-bad hover:text-bad"
                      aria-label="Revoke"
                      onClick={async () => {
                        if (!confirm(s.current ? "Sign this browser out?" : `Revoke ${s.name || "this session"}?`)) return;
                        await api.auth.revoke(s.id);
                        if (s.current) window.location.reload();
                        else await load();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <PasswordCard />
          <AiCard ai={ai} onChange={setAi} />
        </div>
      </div>

      <Modal open={newDevice.open} onClose={() => { setNewDevice({ open: false, name: "" }); void load(); }} title="Add a device">
        {!newDevice.token ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = await api.auth.addDevice(newDevice.name);
              setNewDevice((x) => ({ ...x, token: d.token }));
            }}
          >
            <Field label="Name" hint="So you recognise it later, e.g. 'iPhone' or 'Shortcuts'.">
              <input className="field" value={newDevice.name} onChange={(e) => setNewDevice((x) => ({ ...x, name: e.target.value }))} autoFocus required />
            </Field>
            <div className="flex justify-end">
              <button className="btn-primary">Create token</button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-2">Paste this into the iPhone app (Sync tab, Access token) or a Shortcut's Authorization header. It's shown once; revoke it here any time.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-xl bg-paper-2 px-3 py-2 font-mono text-xs">{newDevice.token}</code>
              <button className="btn-outline" onClick={() => navigator.clipboard.writeText(newDevice.token!).then(() => toast("Copied"))}>
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PasswordCard() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Card className="p-5">
      <SectionTitle>Password</SectionTitle>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.auth.changePassword(cur, next);
            setMsg({ ok: true, text: "Password changed. Every other browser and device was signed out." });
            setCur("");
            setNext("");
          } catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
          }
        }}
      >
        <Field label="Current password">
          <input className="field" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />
        </Field>
        <Field label="New password" hint="At least 10 characters">
          <input className="field" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} />
        </Field>
        {msg && <div className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-good/10 text-good" : "bg-bad/10 text-bad"}`}>{msg.text}</div>}
        <div className="flex justify-end">
          <button className="btn-outline">
            <KeyRound className="h-4 w-4" /> Change password
          </button>
        </div>
      </form>
    </Card>
  );
}

function AiCard({ ai, onChange }: { ai: { enabled: boolean; source: "env" | "settings" | null; model: string } | null; onChange: (a: { enabled: boolean; source: "env" | "settings" | null; model: string }) => void }) {
  const [key, setKey] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card className="p-5">
      <SectionTitle>AI features</SectionTitle>
      <div className="mb-3 flex items-start gap-2 text-sm text-ink-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Meal calorie estimates and AI assessments use {ai?.model ?? "Claude"} through your own Anthropic API key. Only what you ask about is sent: a meal description or photo, or the export for the dates you assess.
        </span>
      </div>
      {ai?.source === "env" ? (
        <div className="rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink-2">On: using ANTHROPIC_API_KEY from the server environment.</div>
      ) : ai?.enabled ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-paper-2 px-3 py-2 text-sm">
          <span className="text-ink-2">On: key saved on the server (never shown again).</span>
          <button className="btn-ghost h-8 px-3 text-xs text-bad hover:text-bad" onClick={async () => onChange(await api.ai.setKey(null))}>
            Remove key
          </button>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              onChange(await api.ai.setKey(key.trim()));
              setKey("");
            } catch (er) {
              setErr(er instanceof Error ? er.message : "Failed");
            }
          }}
        >
          <Field label="Anthropic API key" hint="Create one at console.anthropic.com. It's stored in your database, which is encrypted once you enable database encryption.">
            <input className="field font-mono text-xs" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" required />
          </Field>
          {err && <div className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
          <div className="flex justify-end">
            <button className="btn-primary">Turn on AI</button>
          </div>
        </form>
      )}
    </Card>
  );
}
