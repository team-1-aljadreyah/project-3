import { arN, W } from "@/shared/lib/count-words";
import { Download, Lock, Search, ShieldX, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authApi } from "@/features/auth";
import type { User } from "@/shared/api/types";
import { downloadCsv } from "@/shared/lib/csv";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useQueryParam } from "@/shared/lib/query-param";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Avatar, Button, Empty, ErrorBox, Input, LoadingBlock, MaybeLink, Pill, Select, Skeleton } from "@/shared/ui";
import { adminApi } from "../api";
import { buildDiff, deviceWords, fieldName, parseUserAgent, valueWords } from "../audit-detail";
import { ACTION_KIND, ACTION_WORDS, KIND_WORDS, targetHref } from "../audit-words";
import { AuditDrawer } from "../components/audit-drawer";
import { canSeeAudit } from "../rules";
import type { AuditAction, AuditEntry, AuditFilter, AuditKind } from "../types";

const ACTIONS = Object.keys(ACTION_WORDS) as AuditAction[];
const KINDS = Object.keys(KIND_WORDS) as AuditKind[];
const isFailure = (a: AuditAction) => a === "login_failed" || a === "login_locked";

/**
 * The audit log (the brief: who did it, what kind of action, what data changed and when; normal users can't hide it).
 * Read only: there is no way to change or remove a line. A search box and filters (action, kind, person, address, days),
 * all kept in the address; CSV download. Each line opens a detail panel (`?entry=<id>`, so it can be shared and Back
 * closes it) with everything about it: who, what, when, from where, what changed, and its context.
 */
export function AuditPage() {
  const { tr, lang, dateTime } = useFmt();
  usePageTitle(tr("سجل العمليات", "Audit log"));
  const me = useUser();
  const allowed = canSeeAudit(me);

  const [action, setAction] = useQueryParam<AuditAction | "">("action", "", ["", ...ACTIONS]);
  const [kind, setKind] = useQueryParam<AuditKind | "">("kind", "", ["", ...KINDS]);
  const [actor, setActor] = useQueryParam<string>("actor", "");
  const [ip, setIp] = useQueryParam<string>("ip", "");
  const [q, setQ] = useQueryParam<string>("q", "");
  const [from, setFrom] = useQueryParam<string>("from", "");
  const [to, setTo] = useQueryParam<string>("to", "");
  const filter: AuditFilter = useMemo(
    () => ({
      action: action || undefined,
      kind: kind || undefined,
      actor_id: actor ? Number(actor) || undefined : undefined,
      ip: ip || undefined,
      q: q || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [action, kind, actor, ip, q, from, to],
  );
  const filtered = Object.values(filter).some((v) => v !== undefined);
  // The search and address boxes keep their own text while typing; a new key empties them when the filters are cleared.
  const [boxes, setBoxes] = useState(0);
  const clearAll = () => {
    const url = new URL(window.location.href);
    for (const k of ["action", "kind", "actor", "ip", "q", "from", "to"]) url.searchParams.delete(k);
    window.history.replaceState(null, "", url);
    setBoxes((n) => n + 1);
  };

  const people = useLoad(() => (allowed ? authApi.users() : Promise.resolve([] as User[])), [allowed]);
  const load = useLoad(() => (allowed ? adminApi.audit(filter) : Promise.resolve(null)), [allowed, filter]);
  const entries = load.data ?? null;
  const users = useMemo(() => people.data ?? [], [people.data]);

  const { openId, open, select, close, closeWith } = useEntryParam();

  if (!allowed) return <Empty title={tr("سجل العمليات للإدارة ومسؤول النظام", "The audit log is for management and the admin")} />;

  const personOf = (id?: number) => (id === undefined ? undefined : users.find((u) => u.id === id));
  const nameOf = (id?: number) => {
    if (id === undefined) return tr("محاولة دخول", "Sign-in attempt");
    const u = personOf(id);
    return u ? (lang === "en" && u.name_en ? u.name_en : u.name) : "-";
  };
  const actionOf = (a: AuditAction) => tr(ACTION_WORDS[a].ar, ACTION_WORDS[a].en);
  const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  /** Each changed field as its name and its values: "Job title: Developer → Senior developer", "Criteria: +a 25، −a 30". */
  const changeParts = (e: AuditEntry) =>
    buildDiff(e.changes).map((r) => ({
      field: fieldName(r.field, tr),
      values:
        r.type === "list"
          ? [...r.added.map((x) => `+ ${x}`), ...r.removed.map((x) => `− ${x}`)]
          : [`${valueWords(r.field, r.from, tr) ?? "—"}`, "→", `${valueWords(r.field, r.to, tr) ?? "—"}`],
    }));
  const changesOf = (e: AuditEntry) =>
    changeParts(e)
      .map((p) => `${p.field}: ${p.values.join(" ")}`)
      .join(" · ");
  // Each value is isolated (<bdi>), so an Arabic value in the English page (and the other way round) keeps its order.
  const changesView = (e: AuditEntry) =>
    changeParts(e).map((p, i) => (
      <span key={p.field}>
        {i > 0 && " · "}
        {p.field}:{" "}
        {p.values.map((v, j) => (
          <span key={j}>
            {j > 0 && " "}
            {v === "→" ? "→" : <bdi>{v}</bdi>}
          </span>
        ))}
      </span>
    ));

  const csv = () =>
    entries &&
    downloadCsv("audit-log.csv", [
      [
        tr("الوقت", "Time"),
        tr("من", "Who"),
        tr("البريد", "Email"),
        tr("العملية", "Action"),
        tr("النوع", "Kind"),
        tr("العنصر", "On"),
        tr("ما تغيّر", "What changed"),
        tr("عنوان IP", "IP address"),
        tr("الجهاز", "Device"),
        "User-Agent",
        tr("الجلسة", "Session"),
        tr("رقم الطلب", "Request ID"),
      ],
      ...entries.map((e) => {
        const k = KIND_WORDS[ACTION_KIND[e.action]];
        return [
          e.at,
          nameOf(e.actor_id),
          personOf(e.actor_id)?.email ?? "",
          actionOf(e.action),
          tr(k.ar, k.en),
          e.target.label,
          changesOf(e),
          e.ip ?? "",
          e.user_agent ? deviceWords(parseUserAgent(e.user_agent), tr) : "",
          e.user_agent ?? "",
          e.session_id ?? "",
          e.request_id ?? "",
        ];
      }),
    ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tr("سجل العمليات", "Audit log")}</h1>
          <p className="text-sm text-muted">{tr("لا يمكن لأحد تعديل سطر أو حذفه. اضغط على أي سطر لترى كل تفاصيله.", "Nobody can change or remove a line. Press any line to see everything about it.")}</p>
        </div>
        <Button variant="secondary" size="sm" disabled={!entries} onClick={csv}>
          <Download size={15} aria-hidden="true" />
          {tr("نزّل السجل (CSV)", "Download (CSV)")}
        </Button>
      </div>

      {/* The filters: a search box first, then the narrowing ones. Every value lives in the address. */}
      <div role="search" aria-label={tr("ابحث في السجل", "Search the log")} className="flex flex-col gap-2">
        <div className="relative">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <TypedBox
            key={`q-${boxes}`}
            type="search"
            initial={q}
            onCommit={setQ}
            aria-label={tr("ابحث: الشخص، العنصر، ما تغيّر", "Search: person, subject, changes")}
            placeholder={tr("ابحث بالشخص أو العنصر أو ما تغيّر…", "Search by person, subject or what changed…")}
            className="h-10 ps-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label={tr("نوع العملية", "Action")} value={action} onChange={(e) => setAction(e.target.value as AuditAction | "")} className="h-9 w-auto">
            <option value="">{tr("كل العمليات", "All actions")}</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {actionOf(a)}
              </option>
            ))}
          </Select>
          <Select aria-label={tr("النوع", "Kind")} value={kind} onChange={(e) => setKind(e.target.value as AuditKind | "")} className="h-9 w-auto">
            <option value="">{tr("كل الأنواع", "All kinds")}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {tr(KIND_WORDS[k].ar, KIND_WORDS[k].en)}
              </option>
            ))}
          </Select>
          <Select aria-label={tr("الشخص", "Person")} value={actor} onChange={(e) => setActor(e.target.value)} className="h-9 w-auto">
            <option value="">{tr("كل الأشخاص", "Everyone")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {lang === "en" && u.name_en ? u.name_en : u.name}
              </option>
            ))}
          </Select>
          <TypedBox
            key={`ip-${boxes}`}
            initial={ip}
            onCommit={setIp}
            dir="ltr"
            inputMode="decimal"
            aria-label={tr("عنوان IP (كامل أو بدايته، مثل 192.0.2.)", "IP address (exact or a prefix, like 192.0.2.)")}
            placeholder={tr("عنوان IP", "IP address")}
            className="h-9 w-40 font-mono text-[13px] placeholder:font-sans"
          />
          <Input type="date" aria-label={tr("من تاريخ", "From")} value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-auto" />
          <Input type="date" aria-label={tr("إلى تاريخ", "To")} value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-auto" />
          {filtered && (
            <button type="button" onClick={clearAll} className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-[13px] text-muted hover:bg-chip hover:text-text">
              <X size={14} aria-hidden="true" />
              {tr("امسح التصفية", "Clear filters")}
            </button>
          )}
        </div>
      </div>

      {load.state.status === "loading" && !entries && (
        <LoadingBlock>
          <Skeleton className="h-72" />
        </LoadingBlock>
      )}
      {load.state.status === "error" && <ErrorBox error={load.state.error} onRetry={load.reload} />}
      {entries && entries.length === 0 && <Empty title={tr("لا عمليات مطابقة", "No matching actions")} />}
      {entries && entries.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted" aria-live="polite">
            {tr(`${arN(entries.length, W.line)}`, `${entries.length} line${entries.length === 1 ? "" : "s"}`)}
          </p>
          <ol aria-label={tr("العمليات", "Actions")} className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
            {entries.map((e) => {
              const k = KIND_WORDS[ACTION_KIND[e.action]];
              const failure = isFailure(e.action);
              const person = personOf(e.actor_id);
              const changes = changesOf(e);
              const device = e.user_agent ? deviceWords(parseUserAgent(e.user_agent), tr, false) : undefined;
              const selected = openId === e.id;
              return (
                // The whole line opens its detail panel (the button below covers it); the subject link sits above it
                // and still opens the subject's page.
                <li
                  key={e.id}
                  className={cn(
                    "relative flex gap-3 px-4 py-2.5 text-sm hover:bg-card-2 sm:items-start sm:gap-4",
                    failure && "shadow-[inset_3px_0_0_var(--danger)] rtl:shadow-[inset_-3px_0_0_var(--danger)]",
                    selected && "bg-card-2",
                  )}
                >
                  <span className="hidden pt-0.5 sm:block">
                    {person ? <Avatar user={person} size="sm" /> : <FailMark action={e.action} />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="break-words">
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => open(e.id)}
                        className={cn(
                          "text-start outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-accent focus-visible:after:ring-inset",
                          failure && "text-danger",
                        )}
                      >
                        {/* A sign-in attempt has nobody signed in: the action alone says it. */}
                        {e.actor_id !== undefined && (
                          <>
                            <b className="font-semibold">{nameOf(e.actor_id)}</b>{" "}
                            <span className="text-muted">· </span>
                          </>
                        )}
                        <span className={failure ? "font-semibold" : "text-muted"}>{e.actor_id === undefined && lang === "en" ? capital(actionOf(e.action)) : actionOf(e.action)}</span>
                      </button>
                      <span className="text-muted">: </span>
                      <MaybeLink href={targetHref(e.target)} className="relative z-10">
                        <bdi>{e.target.label}</bdi>
                      </MaybeLink>
                      {failure && (
                        <span className="ms-2 inline-flex items-center gap-1 align-middle text-xs font-medium text-danger">
                          {e.action === "login_locked" ? <Lock size={12} aria-hidden="true" /> : <ShieldX size={12} aria-hidden="true" />}
                          {e.action === "login_locked" ? tr("مقفل", "Locked") : tr("فشل", "Failed")}
                        </span>
                      )}
                    </span>
                    {/* On a computer: where it came from, in one compact line. */}
                    {(e.ip || device) && (
                      <span className="hidden text-[11.5px] text-muted sm:block">
                        <bdi dir="ltr">
                          <span className="font-mono">{e.ip ?? "—"}</span>
                          {device && <> · {device}</>}
                        </bdi>
                      </span>
                    )}
                    {changes && (
                      <span className="line-clamp-2 text-xs text-muted">
                        {changesView(e)}
                      </span>
                    )}
                    {/* On a phone the time and kind go under the line. */}
                    <span className="flex items-center gap-2 text-xs text-muted sm:hidden">
                      <time dateTime={e.at}>{dateTime(e.at)}</time>
                      <Pill tone={k.tone}>{tr(k.ar, k.en)}</Pill>
                    </span>
                  </span>
                  <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                    <time dateTime={e.at} title={e.at} className="text-xs text-muted tabular-nums">
                      {dateTime(e.at)}
                    </time>
                    <Pill tone={k.tone}>{tr(k.ar, k.en)}</Pill>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {openId !== null && (
        <AuditDrawer
          id={openId}
          list={entries ?? []}
          users={users}
          onSelect={select}
          onClose={close}
          onFilterIp={(value) => {
            closeWith({ ip: value });
            setBoxes((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/** A sign-in attempt has no person: a red mark in the avatar's place. */
function FailMark({ action }: { action: AuditAction }) {
  return (
    <span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-full bg-danger-soft text-danger">
      {action === "login_locked" ? <Lock size={12} /> : <ShieldX size={12} />}
    </span>
  );
}

/** A text box that keeps its own text and gives it to the page a moment after typing stops (and at once on Enter). */
function TypedBox({ initial, onCommit, ...props }: Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange"> & { initial: string; onCommit: (v: string) => void }) {
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Input
      {...props}
      defaultValue={initial}
      onChange={(e) => {
        const v = e.target.value.trim();
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => onCommit(v), 250);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        window.clearTimeout(timer.current);
        onCommit(e.currentTarget.value.trim());
      }}
    />
  );
}

/**
 * The open line, kept in the address as `?entry=<id>`. Opening adds a step to the history (so Back closes the panel);
 * stepping to another line replaces it; closing goes back when the panel added the step, else just removes it.
 */
function useEntryParam() {
  const raw = useSearchParams().get("entry");
  const openId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const pushed = useRef(false);
  useEffect(() => {
    if (openId === null) pushed.current = false;
  }, [openId]);

  const open = useCallback((id: number) => {
    window.history.pushState(null, "", urlWith(id));
    pushed.current = true;
  }, []);
  const select = useCallback((id: number) => window.history.replaceState(null, "", urlWith(id)), []);
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else window.history.replaceState(null, "", urlWith(null));
  }, []);
  /** Closes and sets filters in one step (the panel's "All actions from this IP"). */
  const closeWith = useCallback((params: Record<string, string>) => {
    pushed.current = false;
    const url = urlWith(null);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    window.history.replaceState(null, "", url);
  }, []);
  return { openId, open, select, close, closeWith };
}

/** This page's address with another open line (or none). */
function urlWith(id: number | null) {
  const url = new URL(window.location.href);
  if (id === null) url.searchParams.delete("entry");
  else url.searchParams.set("entry", String(id));
  return url;
}
