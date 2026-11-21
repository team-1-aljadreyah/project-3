import { Download } from "lucide-react";
import { useState } from "react";
import { authApi } from "@/features/auth";
import { downloadCsv } from "@/shared/lib/csv";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { Button, Empty, ErrorBox, Input, LoadingBlock, MaybeLink, Select, Skeleton } from "@/shared/ui";
import { adminApi } from "../api";
import { ACTION_WORDS, targetHref } from "../audit-words";
import { canSeeAudit } from "../rules";
import type { AuditAction, AuditFilter } from "../types";

/**
 * The audit log (the brief: who did it, what kind of action, what data changed and when; normal users can't hide it).
 * Read only: there is no way to change or remove a line. Filters by action, person and days; downloads as CSV.
 */
export function AuditPage() {
  const { tr, lang, dateTime } = useFmt();
  usePageTitle(tr("سجل العمليات", "Audit log"));
  const me = useUser();
  const allowed = canSeeAudit(me);
  const [filter, setFilter] = useState<AuditFilter>({});
  const load = useLoad(() => (allowed ? Promise.all([adminApi.audit(filter), authApi.users()]) : Promise.resolve(null)), [allowed, filter]);
  if (!allowed) return <Empty title={tr("سجل العمليات للإدارة ومسؤول النظام", "The audit log is for management and the admin")} />;

  const users = load.data?.[1] ?? [];
  const nameOf = (id?: number) => {
    if (!id) return tr("غير معروف", "Unknown");
    const u = users.find((x) => x.id === id);
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };
  const actionOf = (a: AuditAction) => tr(ACTION_WORDS[a].ar, ACTION_WORDS[a].en);
  const changesOf = (c?: { field: string; from?: string; to?: string }[]) => (c ?? []).map((x) => `${x.field}: ${x.from ?? "-"} → ${x.to ?? "-"}`).join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tr("سجل العمليات", "Audit log")}</h1>
          <p className="text-sm text-muted">{tr("لا يمكن لأحد تعديل سطر أو حذفه.", "Nobody can change or remove a line.")}</p>
        </div>
        <Button
          variant="secondary"
          pill
          disabled={!load.data}
          onClick={() =>
            load.data &&
            downloadCsv("audit-log.csv", [
              [tr("الوقت", "Time"), tr("من", "Who"), tr("العملية", "Action"), tr("على", "On"), tr("ما تغيّر", "What changed")],
              ...load.data[0].map((e) => [e.at, nameOf(e.actor_id), actionOf(e.action), e.target.label, changesOf(e.changes)]),
            ])
          }
        >
          <Download size={15} aria-hidden="true" />
          {tr("نزّل السجل (CSV)", "Download (CSV)")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label={tr("نوع العملية", "Action")} value={filter.action ?? ""} onChange={(e) => setFilter({ ...filter, action: (e.target.value || undefined) as AuditAction | undefined })} className="h-9 w-auto">
          <option value="">{tr("كل العمليات", "All actions")}</option>
          {(Object.keys(ACTION_WORDS) as AuditAction[]).map((a) => (
            <option key={a} value={a}>
              {actionOf(a)}
            </option>
          ))}
        </Select>
        <Select aria-label={tr("الشخص", "Person")} value={filter.actor_id ?? ""} onChange={(e) => setFilter({ ...filter, actor_id: e.target.value ? Number(e.target.value) : undefined })} className="h-9 w-auto">
          <option value="">{tr("كل الأشخاص", "Everyone")}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {lang === "en" && u.name_en ? u.name_en : u.name}
            </option>
          ))}
        </Select>
        <Input type="date" aria-label={tr("من يوم", "From")} value={filter.from ?? ""} onChange={(e) => setFilter({ ...filter, from: e.target.value || undefined })} className="h-9 w-auto" />
        <Input type="date" aria-label={tr("إلى يوم", "To")} value={filter.to ?? ""} onChange={(e) => setFilter({ ...filter, to: e.target.value || undefined })} className="h-9 w-auto" />
      </div>

      {load.state.status === "loading" && !load.data && (
        <LoadingBlock>
          <Skeleton className="h-72" />
        </LoadingBlock>
      )}
      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}
      {load.data && load.data[0].length === 0 && <Empty title={tr("لا عمليات مطابقة", "No matching actions")} />}
      {load.data && load.data[0].length > 0 && (
        <ol aria-label={tr("العمليات", "Actions")} className="flex flex-col divide-y divide-line rounded-xl border border-line bg-card">
          {load.data[0].map((e) => (
            // The whole line opens what the action was about, when it has a page.
            <li key={e.id} className="relative flex flex-col gap-1 px-4 py-3 text-sm hover:bg-card-2 sm:flex-row sm:items-baseline sm:gap-4">
              <time dateTime={e.at} className="w-40 shrink-0 text-xs text-muted">
                {dateTime(e.at)}
              </time>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span>
                  <b>{nameOf(e.actor_id)}</b> · {actionOf(e.action)}:{" "}
                  <MaybeLink href={targetHref(e.target)} cover>
                    <bdi>{e.target.label}</bdi>
                  </MaybeLink>
                </span>
                {e.changes && (
                  <span dir="auto" className="text-xs text-muted">
                    {changesOf(e.changes)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
