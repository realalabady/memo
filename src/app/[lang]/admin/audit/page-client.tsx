"use client";

import { Fragment, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/shell";
import { Panel, Table } from "@/components/dashboard/widgets";
import { useFormat, useT } from "@/i18n/client";
import { fmt } from "@/i18n/dictionaries";
import { useAuditLogs, useUsers } from "@/lib/data/hooks";

export default function AdminAudit() {
  const t = useT().audit;
  const { date } = useFormat();
  const { data: logs, loading } = useAuditLogs();
  const { data: users } = useUsers();
  const [open, setOpen] = useState<string | null>(null);
  const who = useMemo(() => new Map(users.map((u) => [u.id, u.email || u.displayName])), [users]);

  return (
    <>
      <PageHeader eyebrow={fmt(t.eyebrow, { n: logs.length })} title={<>{t.title} <span className="italic">{t.titleEm}</span></>} />
      <Panel>
        <Table head={[t.when, t.who, t.action, t.target, ""]} empty={!loading && !logs.length}>
          {logs.map((l) => (
            <Fragment key={l.id}>
              <tr>
                <td className="whitespace-nowrap text-muted">{date(l.createdAt, true)}</td>
                <td className="max-w-48 truncate" dir="ltr">{who.get(l.actorUid) ?? l.actorUid}</td>
                <td className="whitespace-nowrap font-mono text-xs">{l.action}</td>
                <td className="max-w-56 truncate font-mono text-xs text-muted" dir="ltr">{l.target}</td>
                <td className="text-end">
                  {l.data && Object.keys(l.data).length > 0 && (
                    <button onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id} className="text-xs text-muted hover:text-ink">
                      {t.details}
                    </button>
                  )}
                </td>
              </tr>
              {open === l.id && (
                <tr>
                  <td colSpan={5} className="!bg-cream/40">
                    <pre dir="ltr" className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[12px] leading-relaxed text-ink/75">{JSON.stringify(l.data, null, 2)}</pre>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </Table>
      </Panel>
    </>
  );
}
