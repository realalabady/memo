"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, Table } from "@/components/dashboard/widgets";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuth } from "@/lib/auth/auth-provider";
import { useUsers } from "@/lib/data/hooks";
import { updateUserAccess } from "@/lib/data/mutations";
import { normalize } from "@/lib/search";
import type { Role, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | Role;

const roleTone: Record<Role, string> = {
  admin: "bg-ink text-paper",
  merchant: "bg-[#e3e6f2] text-[#3d4673]",
  customer: "bg-sand text-ink-2",
};

export default function AdminUsers() {
  const t = useT().users;
  const { date } = useFormat();
  const { user: me } = useAuth();
  const { data: users, loading } = useUsers();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const s = normalize(q);
    return users.filter((u) => (filter === "all" || u.role === filter) && (!s || normalize(`${u.displayName ?? ""} ${u.email ?? ""}`).includes(s)));
  }, [users, q, filter]);

  async function change(u: UserProfile & { id: string }, patch: { admin?: boolean; disabled?: boolean }, question?: string) {
    if (question && !confirm(fmt(question, { name: u.displayName || u.email }))) return;
    setBusy(u.id);
    try {
      await updateUserAccess(u.id, patch);
      toast(t.updated);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const filters: [Filter, string][] = [
    ["all", t.all],
    ["admin", t.admins],
    ["merchant", t.merchants],
    ["customer", t.customers],
  ];

  return (
    <>
      <PageHeader eyebrow={fmt(t.eyebrow, { n: users.length })} title={<>{t.title} <span className="italic">{t.titleEm}</span></>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-paper px-4 ring-1 ring-ink/[0.08] sm:min-w-64 md:max-w-sm">
          <MagnifyingGlass weight="light" className="size-4 shrink-0 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className="w-full min-w-0 bg-transparent text-sm outline-none" />
        </label>
        <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full bg-ink/[0.04] p-1">
          {filters.map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-[12px] transition", filter === key ? "bg-paper shadow-sm" : "text-muted")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <Panel>
        <Table head={[t.name, t.role, t.joined, t.state, ""]} empty={!loading && !rows.length}>
          {rows.map((u) => {
            const self = u.id === me?.uid;
            return (
              <tr key={u.id}>
                <td>
                  <p className="whitespace-nowrap">
                    {u.displayName || "—"} {self && <span className="text-[11px] text-muted">({t.you})</span>}
                  </p>
                  <p className="text-[11px] text-muted" dir="ltr">{u.email}</p>
                </td>
                <td>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", roleTone[u.role] ?? "bg-ink/5")}>{t.roles[u.role] ?? u.role}</span>
                </td>
                <td className="whitespace-nowrap text-muted">{u.createdAt ? date(u.createdAt) : "—"}</td>
                <td className={u.disabled ? "text-ember" : "text-muted"}>{u.disabled ? t.disabled : t.active}</td>
                <td className="whitespace-nowrap text-end">
                  {!self && (
                    <>
                      <button
                        disabled={busy === u.id}
                        onClick={() => change(u, { admin: u.role !== "admin" }, u.role === "admin" ? t.confirmRemoveAdmin : t.confirmMakeAdmin)}
                        className="rounded-full px-3 py-1.5 text-xs text-muted ring-1 ring-ink/10 hover:text-ink"
                      >
                        {u.role === "admin" ? t.removeAdmin : t.makeAdmin}
                      </button>
                      <button
                        disabled={busy === u.id}
                        onClick={() => (u.disabled ? change(u, { disabled: false }) : change(u, { disabled: true }, t.confirmDisable))}
                        className={cn("ms-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-ink/10", u.disabled ? "bg-ink text-paper" : "text-muted hover:text-ember")}
                      >
                        {u.disabled ? t.enable : t.disable}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Panel>
      {users.length >= 500 && <p className="mt-3 text-center text-[12px] text-muted">{t.limitNote}</p>}
    </>
  );
}
