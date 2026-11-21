"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckCircle, Copy, ShieldWarning, WarningCircle } from "@phosphor-icons/react";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel } from "@/components/dashboard/widgets";
import { Button, ProviderChip } from "@/components/ui/primitives";
import { useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth } from "@/lib/auth/auth-provider";
import { checkPaymentProvider, getPaymentSetup, savePaymentSetup, type PaymentSetup } from "@/lib/data/mutations";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

type Provider = "tabby" | "tamara";
const SANDBOX = "https://api-sandbox.tamara.co";
const PRODUCTION = "https://api.tamara.co";

/** Demo mode has no server: show an empty, read-only form. */
const demoSetup: PaymentSetup = {
  tabby: { secretKey: "", merchantCode: "", apiUrl: "https://api.tabby.ai", webhookSecret: "", testMode: false, configured: false, enabled: true, webhookUrl: "/api/webhooks/tabby" },
  tamara: { apiToken: "", apiUrl: SANDBOX, notificationToken: "", testMode: true, configured: false, enabled: true, webhookUrl: "/api/webhooks/tamara" },
  sources: { tabby: {}, tamara: {}, updatedAt: 0 } as PaymentSetup["sources"],
  publicHttps: false,
  simulator: true,
};

function SecretField({ label, name, current, source, hint, onRemove }: { label: string; name: string; current: string; source?: string; hint?: string; onRemove?: () => void }) {
  const t = useT().payments;
  return (
    <label className="block">
      <span className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        {label}
        <span className="normal-case tracking-normal">
          {current ? fmt(t.current, { value: current }) : t.notSet}
          {source && source !== "none" && ` · ${source === "env" ? t.fromEnv : t.fromDashboard}`}
          {onRemove && source === "dashboard" && (
            <button type="button" onClick={onRemove} className="ms-2 text-ember underline-offset-2 hover:underline">
              {t.remove}
            </button>
          )}
        </span>
      </span>
      <input
        name={name}
        type="password"
        autoComplete="off"
        spellCheck={false}
        dir="ltr"
        placeholder={current || "—"}
        className="h-11 w-full rounded-2xl bg-paper px-4 font-mono text-[14px] outline-none ring-1 ring-ink/10 placeholder:text-muted/60 focus:ring-ink/30"
      />
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

function Status({ configured, enabled, testMode }: { configured: boolean; enabled: boolean; testMode: boolean }) {
  const t = useT().payments;
  const [label, tone] = !enabled ? [t.off, "bg-ink/5 text-muted"] : !configured ? [t.missing, "bg-ember-soft text-[#8f321a]"] : testMode ? [t.test, "bg-sand text-ink-2"] : [t.live, "bg-sage-soft text-[#4c5a3f]"];
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", tone)}>{label}</span>;
}

function CopyRow({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  const t = useT().payments;
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-2xl bg-cream/70 p-1 ps-4">
        <code dir="ltr" className="min-w-0 flex-1 truncate text-[12px]">{value}</code>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(value).then(() => toast(t.copied))}
          className="flex shrink-0 items-center gap-1 rounded-full bg-paper px-3 py-1.5 text-xs ring-1 ring-ink/10"
        >
          <Copy className="size-3.5" /> {t.copy}
        </button>
      </div>
      {note && <p className="mt-1.5 text-[11px] text-muted">{note}</p>}
    </div>
  );
}

export default function AdminPayments() {
  const t = useT().payments;
  const { signOut } = useAuth();
  const [setup, setSetup] = useState<PaymentSetup | null>(isFirebaseConfigured ? null : demoSetup);
  const [busy, setBusy] = useState<string | null>(null);
  const [checks, setChecks] = useState<Partial<Record<Provider, { ok: boolean; message: string; webhookRegistered?: boolean }>>>({});
  const [needsReauth, setNeedsReauth] = useState(false);

  const load = useCallback(async () => {
    if (!isFirebaseConfigured) return;
    try {
      setSetup(await getPaymentSetup());
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches once; state is set after the request resolves
    load();
  }, [load]);

  async function run<T>(id: string, fn: () => Promise<T>, okMsg?: string) {
    setBusy(id);
    try {
      const out = await fn();
      if (okMsg) toast(okMsg);
      await load();
      return out;
    } catch (err) {
      const msg = (err as Error).message;
      if (/sign in again/i.test(msg)) setNeedsReauth(true);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  function save(e: FormEvent<HTMLFormElement>, provider: Provider) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const fields = Object.fromEntries([...f.entries()].filter(([k, v]) => k !== "enabled" && typeof v === "string").map(([k, v]) => [k, String(v).trim()]));
    run(
      `save-${provider}`,
      async () => {
        await savePaymentSetup({ [provider]: fields, [`${provider}Enabled`]: f.get("enabled") === "on" });
        form.reset();
      },
      fmt(t.saved, { provider: provider === "tabby" ? "Tabby" : "Tamara" }),
    );
  }

  const remove = (path: string) => run(`clear-${path}`, () => savePaymentSetup({ clear: [path] }));
  const check = (provider: Provider, action: "test" | "register-webhook" = "test") =>
    run(`${action}-${provider}`, async () => {
      const result = await checkPaymentProvider(provider, action);
      setChecks((c) => ({ ...c, [provider]: result }));
      (result.ok ? toast : toast.error)(result.message);
    });

  if (!setup) return <div className="h-96 animate-pulse rounded-[1.75rem] bg-cream" />;
  const src = setup.sources;
  const readOnly = !isFirebaseConfigured;

  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={<>{t.title} <span className="italic">{t.titleEm}</span></>} />
      <div className="mb-4 space-y-2">
        <p className="flex gap-2 rounded-2xl bg-ember-soft px-4 py-3 text-[13px] text-[#8f321a]">
          <ShieldWarning weight="fill" className="mt-0.5 size-4 shrink-0" /> {t.securityNote}
        </p>
        <p className="rounded-2xl bg-cream/70 px-4 py-3 text-[13px] text-ink/70">
          {t.intro} {setup.simulator && t.simulatorNote} {t.getKeys}
        </p>
        {needsReauth && (
          <button
            onClick={() => signOut(`/login?next=${encodeURIComponent("/admin/payments")}`)}
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper"
          >
            {t.signInAgain}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Tabby */}
        <Panel
          title="Tabby"
          actions={
            <div className="flex items-center gap-2">
              <ProviderChip provider="tabby" />
              <Status configured={setup.tabby.configured} enabled={setup.tabby.enabled} testMode={setup.tabby.testMode} />
            </div>
          }
        >
          <form key={`tabby-${src.updatedAt}-${setup.tabby.enabled}`} onSubmit={(e) => save(e, "tabby")}>
            <fieldset disabled={readOnly} className="grid min-w-0 gap-4 p-5">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="enabled" defaultChecked={setup.tabby.enabled} className="size-4 accent-ink" />
                {t.enabled}
              </label>
              <SecretField label={t.secretKey} name="secretKey" current={setup.tabby.secretKey} source={src.tabby.secretKey} onRemove={() => remove("tabby.secretKey")} />
              <label className="block">
                <span className="mb-1.5 flex justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                  {t.merchantCode}
                  {src.tabby.merchantCode === "env" && <span className="normal-case tracking-normal">{t.fromEnv}</span>}
                </span>
                <input name="merchantCode" dir="ltr" autoComplete="off" defaultValue={setup.tabby.merchantCode} className="h-11 w-full rounded-2xl bg-paper px-4 font-mono text-[14px] outline-none ring-1 ring-ink/10 focus:ring-ink/30" />
              </label>
              <SecretField label={t.webhookSecret} name="webhookSecret" current={setup.tabby.webhookSecret} source={src.tabby.webhookSecret} hint={t.webhookSecretHint} onRemove={() => remove("tabby.webhookSecret")} />
              <CopyRow label={t.webhook} value={setup.tabby.webhookUrl} note={!setup.publicHttps && t.httpsNote} />
              {checks.tabby && (
                <p className={cn("flex items-start gap-2 rounded-2xl px-3 py-2 text-[12px]", checks.tabby.ok ? "bg-sage-soft text-[#4c5a3f]" : "bg-ember-soft text-[#8f321a]")}>
                  {checks.tabby.ok ? <CheckCircle className="mt-0.5 size-4 shrink-0" /> : <WarningCircle className="mt-0.5 size-4 shrink-0" />}
                  <span>
                    {checks.tabby.message}
                    {checks.tabby.ok && checks.tabby.webhookRegistered !== undefined && ` ${checks.tabby.webhookRegistered ? t.webhookOk : t.webhookMissing}.`}
                  </span>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy !== null}>{t.save}</Button>
                <button type="button" disabled={busy !== null || !setup.tabby.configured} onClick={() => check("tabby")} className="rounded-full px-4 py-2.5 text-sm ring-1 ring-ink/10 disabled:opacity-40">
                  {busy === "test-tabby" ? t.testing : t.testConnection}
                </button>
                <button type="button" disabled={busy !== null || !setup.tabby.configured || !setup.publicHttps} onClick={() => check("tabby", "register-webhook")} className="rounded-full px-4 py-2.5 text-sm ring-1 ring-ink/10 disabled:opacity-40">
                  {t.registerWebhook}
                </button>
              </div>
            </fieldset>
          </form>
        </Panel>

        {/* Tamara */}
        <Panel
          title="Tamara"
          actions={
            <div className="flex items-center gap-2">
              <ProviderChip provider="tamara" />
              <Status configured={setup.tamara.configured} enabled={setup.tamara.enabled} testMode={setup.tamara.testMode} />
            </div>
          }
        >
          <form key={`tamara-${src.updatedAt}-${setup.tamara.enabled}-${setup.tamara.apiUrl}`} onSubmit={(e) => save(e, "tamara")}>
            <fieldset disabled={readOnly} className="grid min-w-0 gap-4 p-5">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="enabled" defaultChecked={setup.tamara.enabled} className="size-4 accent-ink" />
                {t.enabled}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{t.environment}</span>
                <select name="apiUrl" defaultValue={setup.tamara.apiUrl} className="h-11 w-full rounded-2xl bg-paper px-3 text-sm outline-none ring-1 ring-ink/10">
                  <option value={SANDBOX}>{t.sandbox}</option>
                  <option value={PRODUCTION}>{t.production}</option>
                </select>
              </label>
              <SecretField label={t.apiToken} name="apiToken" current={setup.tamara.apiToken} source={src.tamara.apiToken} onRemove={() => remove("tamara.apiToken")} />
              <SecretField label={t.notificationToken} name="notificationToken" current={setup.tamara.notificationToken} source={src.tamara.notificationToken} onRemove={() => remove("tamara.notificationToken")} />
              <CopyRow label={t.webhook} value={setup.tamara.webhookUrl} note={setup.publicHttps ? t.tamaraWebhookNote : t.httpsNote} />
              {checks.tamara && (
                <p className={cn("flex items-start gap-2 rounded-2xl px-3 py-2 text-[12px]", checks.tamara.ok ? "bg-sage-soft text-[#4c5a3f]" : "bg-ember-soft text-[#8f321a]")}>
                  {checks.tamara.ok ? <CheckCircle className="mt-0.5 size-4 shrink-0" /> : <WarningCircle className="mt-0.5 size-4 shrink-0" />}
                  <span>{checks.tamara.message}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy !== null}>{t.save}</Button>
                <button type="button" disabled={busy !== null || !setup.tamara.configured} onClick={() => check("tamara")} className="rounded-full px-4 py-2.5 text-sm ring-1 ring-ink/10 disabled:opacity-40">
                  {busy === "test-tamara" ? t.testing : t.testConnection}
                </button>
              </div>
            </fieldset>
          </form>
        </Panel>
      </div>
    </>
  );
}
