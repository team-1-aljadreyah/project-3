import { Check, ChevronDown, ChevronUp, Copy, Filter, Lock, ShieldX, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { useRoleName } from "@/shared/lib/site";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Avatar, ErrorBox, MaybeLink, PersonName, Pill, Skeleton } from "@/shared/ui";
import { adminApi } from "../api";
import { buildDiff, DEVICE_KIND, detailText, deviceWords, fieldName, parseUserAgent, shortSession, valueWords } from "../audit-detail";
import { ACTION_KIND, ACTION_WORDS, KIND_WORDS, targetHref } from "../audit-words";
import type { AuditEntry } from "../types";

/** Full date and time with seconds and the time zone: "Thursday 20 November 2026, 10:30:15 GMT+3". */
function useExactTime() {
  const { lang } = useFmt();
  const f = new Intl.DateTimeFormat(lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
  return (iso: string) => f.format(new Date(iso));
}

/** A sign-in line's result in words (other lines: none). */
export function signInResult(e: AuditEntry, tr: (ar: string, en: string) => string, minutes?: string) {
  if (e.action === "login_failed") {
    return e.target.id !== undefined
      ? tr("لم ينجح: كلمة مرور خاطئة", "Failed: wrong password")
      : tr("لم ينجح: لا حساب بهذا البريد", "Failed: no account with this email");
  }
  if (e.action === "login_locked") {
    return minutes
      ? tr(`قُفل الحساب لمدة ${minutes} دقيقة بعد محاولات خاطئة`, `Account locked for ${minutes} minutes after wrong passwords`)
      : tr("قُفل الحساب بعد محاولات خاطئة", "Account locked after wrong passwords");
  }
  return undefined;
}

/**
 * The detail panel of one audit line: a side drawer on a computer, the whole screen on a phone. Who, what, when, from
 * where, what changed (before → after), the same person's other actions that day and the subject's history, and
 * "Copy details". ↑ and ↓ (or the arrows at the top) step through the list on the page without closing; Escape closes.
 * It is the browser's own modal <dialog>: the keyboard stays inside, and focus goes back to the line that opened it.
 */
export function AuditDrawer({
  id,
  list,
  users,
  onSelect,
  onClose,
  onFilterIp,
}: {
  id: number;
  /** The lines on the page (filtered, newest first), to step through. */
  list: AuditEntry[];
  users: User[];
  onSelect: (id: number) => void;
  onClose: () => void;
  onFilterIp: (ip: string) => void;
}) {
  const { tr, lang, dateTime, ago } = useFmt();
  const roleName = useRoleName();
  const exact = useExactTime();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // The context tab the person chose; until then the one that has lines (the same person first).
  const [chosenTab, setTab] = useState<"actor" | "target" | null>(null);
  // "Copied" shows on the button itself for a moment (a toast would sit under the panel's dark backdrop).
  const [copied, setCopied] = useState<number | null>(null);
  const load = useLoad(() => adminApi.auditEntry(id), [id]);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      d.showModal();
      // The close button, so the first Tab and the screen reader start at the top of the panel.
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  const index = list.findIndex((e) => e.id === id);
  const prev = index > 0 ? list[index - 1] : undefined;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : undefined;
  // What the list already has shows at once; the server's answer adds the context (and a line the list doesn't have).
  const detail = load.data?.id === id ? load.data : undefined;
  const entry: AuditEntry | undefined = detail ?? list.find((e) => e.id === id);
  const tab = chosenTab ?? (detail && !detail.related_by_actor.length && detail.related_by_target.length ? "target" : "actor");

  const person = (uid?: number) => (uid === undefined ? undefined : users.find((u) => u.id === uid));
  const nameOf = (u?: Pick<User, "name" | "name_en">) => (u ? (lang === "en" && u.name_en ? u.name_en : u.name) : tr("غير معروف", "Unknown"));
  const actionOf = (e: AuditEntry) => tr(ACTION_WORDS[e.action].ar, ACTION_WORDS[e.action].en);
  /** The English words start in lower case ("changed a user"): capital when they start a sentence. */
  const capital = (s: string) => (lang === "en" ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    const el = ev.target as HTMLElement;
    if (el.closest("input, textarea, select, [role=tab]")) return;
    const to = ev.key === "ArrowDown" ? next : ev.key === "ArrowUp" ? prev : undefined;
    if (!to) return;
    ev.preventDefault();
    onSelect(to.id);
  };

  const actor = person(entry?.actor_id);
  const device = parseUserAgent(entry?.user_agent);
  const kind = entry ? KIND_WORDS[ACTION_KIND[entry.action]] : undefined;
  const failed = entry?.action === "login_failed" || entry?.action === "login_locked";
  const minutes = entry?.changes?.find((c) => c.field === "minutes")?.to;
  const result = entry ? signInResult(entry, tr, minutes) : undefined;
  const signInAccount = entry && (entry.target.type === "login" || entry.action === "login_locked") ? person(entry.target.id) : undefined;
  const diff = buildDiff(entry?.changes);

  const copy = async () => {
    if (!entry || !kind) return;
    const text = detailText(entry, {
      tr,
      who: actor ? `${nameOf(actor)} <${actor.email}>` : tr("لا أحد (لم يسجّل الدخول)", "Nobody (not signed in)"),
      action: actionOf(entry),
      when: exact(entry.at),
      kind: tr(kind.ar, kind.en),
      device: deviceWords(device, tr),
      result,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(entry.id);
      window.setTimeout(() => setCopied((c) => (c === entry.id ? null : c)), 2000);
    } catch {
      setCopied(-1);
    }
  };

  return (
    // The click below is mouse-only on purpose: on a keyboard, Escape (onCancel) closes the panel.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
      className={cn(
        "drawer-in m-0 h-dvh max-h-none w-full max-w-none border-line bg-card p-0 text-text shadow-2xl backdrop:bg-black/30",
        "sm:start-auto sm:end-0 sm:w-[min(36rem,100vw)] sm:border-s",
      )}
    >
      <div className="flex h-full flex-col">
        {/* The top: the line's number and kind, stepping, copying and closing. */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 sm:px-5">
          <span className="font-mono text-xs text-muted" dir="ltr">
            #{id}
          </span>
          {kind && <Pill tone={kind.tone}>{tr(kind.ar, kind.en)}</Pill>}
          <span className="ms-auto flex items-center gap-1">
            {index >= 0 && (
              <span className="me-1 text-xs whitespace-nowrap text-muted tabular-nums">
                {tr(`${index + 1} من ${list.length}`, `${index + 1} of ${list.length}`)}
              </span>
            )}
            <ToolButton label={tr("السطر السابق (↑)", "Previous line (↑)")} disabled={!prev} onClick={() => prev && onSelect(prev.id)}>
              <ChevronUp size={16} aria-hidden="true" />
            </ToolButton>
            <ToolButton label={tr("السطر التالي (↓)", "Next line (↓)")} disabled={!next} onClick={() => next && onSelect(next.id)}>
              <ChevronDown size={16} aria-hidden="true" />
            </ToolButton>
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
            <button
              type="button"
              onClick={copy}
              disabled={!entry}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-[13px] font-medium hover:bg-card-2 disabled:opacity-50"
            >
              {copied === id ? <Check size={14} aria-hidden="true" className="text-success" /> : <Copy size={14} aria-hidden="true" />}
              {/* On a phone only the icon shows (the words stay for screen readers). */}
              <span className="sr-only sm:not-sr-only">
                {copied === id ? tr("نُسخت", "Copied") : copied === -1 ? tr("تعذّر النسخ", "Couldn't copy") : tr("انسخ التفاصيل", "Copy details")}
              </span>
            </button>
            <span role="status" className="sr-only">
              {copied === id ? tr("نُسخت التفاصيل.", "Details copied.") : ""}
            </span>
            <ToolButton label={tr("إغلاق", "Close")} onClick={onClose} data-autofocus>
              <X size={16} aria-hidden="true" />
            </ToolButton>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {!entry && load.state.status === "loading" && (
            <div className="flex flex-col gap-3 p-5">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          )}
          {!entry && load.state.status === "error" && (
            <div className="p-5">
              <ErrorBox error={load.state.error} onRetry={load.reload} />
            </div>
          )}
          {entry && kind && (
            <>
              {/* The line in one sentence. */}
              <div className="flex items-start gap-3 px-4 pt-5 pb-4 sm:px-5">
                {actor ? <Avatar user={actor} size="lg" /> : <NoOne failed={failed} />}
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 id={titleId} className="text-base leading-snug font-semibold">
                    {actor ? (
                      <>
                        {nameOf(actor)} <span className="font-normal text-muted">{actionOf(entry)}</span>
                      </>
                    ) : (
                      capital(actionOf(entry))
                    )}
                  </h2>
                  <p className="text-sm break-words">
                    <bdi>{entry.target.label}</bdi>
                  </p>
                  <p className="text-xs text-muted">
                    <time dateTime={entry.at}>{dateTime(entry.at)}</time> · {ago(entry.at)}
                  </p>
                </div>
              </div>

              {result && (
                <p className={cn("mx-4 mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium sm:mx-5", "border-danger/40 bg-danger-soft text-danger")}>
                  {entry.action === "login_locked" ? <Lock size={15} aria-hidden="true" /> : <ShieldX size={15} aria-hidden="true" />}
                  {result}
                </p>
              )}

              <Section title={tr("من", "Who")}>
                {actor ? (
                  <>
                    <Row label={tr("الاسم", "Name")}>
                      <PersonName person={actor} className="font-medium" />
                    </Row>
                    <Row label={tr("الوظيفة", "Job")}>
                      {roleName(actor)}
                      {actor.title && <span className="text-muted"> · {actor.title}</span>}
                    </Row>
                    <Row label={tr("البريد", "Email")}>
                      <span dir="ltr" className="font-mono text-[13px] break-all">
                        {actor.email}
                      </span>
                    </Row>
                  </>
                ) : (
                  <>
                    <Row label={tr("الاسم", "Name")}>
                      <span className="text-muted">{tr("لم يكن أحد مسجّلاً الدخول", "Nobody was signed in")}</span>
                    </Row>
                    {entry.target.type === "login" && (
                      <Row label={tr("البريد المكتوب", "Email typed")}>
                        <span dir="ltr" className="font-mono text-[13px] break-all">
                          {entry.target.label}
                        </span>
                      </Row>
                    )}
                    {signInAccount && (
                      <Row label={tr("الحساب", "Account")}>
                        <PersonName person={signInAccount} />
                      </Row>
                    )}
                  </>
                )}
              </Section>

              <Section title={tr("ماذا", "What")}>
                <Row label={tr("العملية", "Action")}>{capital(actionOf(entry))}</Row>
                <Row label={tr("على", "Subject")}>
                  <MaybeLink href={targetHref(entry.target)} className={cn("font-medium underline-offset-2", targetHref(entry.target) && "text-accent-ink")}>
                    <bdi>{entry.target.label}</bdi>
                  </MaybeLink>
                  {entry.target.id !== undefined && (
                    <span className="ms-1.5 font-mono text-xs text-muted" dir="ltr">
                      #{entry.target.id}
                    </span>
                  )}
                </Row>
                <Row label={tr("النوع", "Kind")}>
                  <Pill tone={kind.tone}>{tr(kind.ar, kind.en)}</Pill>
                </Row>
              </Section>

              <Section title={tr("متى", "When")}>
                <Row label={tr("الوقت", "Time")}>
                  <time dateTime={entry.at}>{exact(entry.at)}</time>
                </Row>
                <Row label={tr("منذ", "Ago")}>{ago(entry.at)}</Row>
                <Row label="UTC">
                  <span dir="ltr" className="font-mono text-[13px]">
                    {entry.at}
                  </span>
                </Row>
              </Section>

              <Section title={tr("من أين", "From where")}>
                <Row label={tr("عنوان IP", "IP address")}>
                  {entry.ip ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span dir="ltr" className="font-mono text-[13px]">
                        {entry.ip}
                      </span>
                      <button
                        type="button"
                        onClick={() => onFilterIp(entry.ip!)}
                        className="inline-flex items-center gap-1 rounded text-xs text-muted underline-offset-2 hover:text-text hover:underline"
                      >
                        <Filter size={12} aria-hidden="true" />
                        {tr("كل عمليات هذا العنوان", "All actions from this IP")}
                      </button>
                    </span>
                  ) : (
                    <span className="text-muted">{tr("غير مسجّل", "Not recorded")}</span>
                  )}
                </Row>
                <Row label={tr("الجهاز", "Device")}>
                  {deviceWords(device, tr)}
                  <span className="text-muted"> · {tr(DEVICE_KIND[device.kind].ar, DEVICE_KIND[device.kind].en)}</span>
                  {entry.user_agent && (
                    <details className="group mt-1">
                      <summary className="cursor-pointer list-none text-xs text-muted hover:text-text [&::-webkit-details-marker]:hidden">
                        <span className="underline-offset-2 group-open:underline">{tr("نص المتصفح الكامل (User-Agent)", "Full User-Agent")}</span>
                      </summary>
                      <code dir="ltr" className="mt-1 block rounded-md bg-card-2 px-2 py-1.5 font-mono text-[11px] leading-relaxed break-all text-muted">
                        {entry.user_agent}
                      </code>
                    </details>
                  )}
                </Row>
                <Row label={tr("الجلسة", "Session")}>
                  {entry.session_id ? (
                    <span dir="ltr" title={entry.session_id} className="font-mono text-[13px]">
                      {shortSession(entry.session_id)}
                    </span>
                  ) : (
                    <span className="text-muted">{tr("لا جلسة (قبل الدخول)", "None (before signing in)")}</span>
                  )}
                </Row>
                {entry.request_id && (
                  <Row label={tr("رقم الطلب", "Request ID")}>
                    <span dir="ltr" className="font-mono text-[13px] text-muted">
                      {entry.request_id}
                    </span>
                  </Row>
                )}
              </Section>

              <Section title={tr("ما تغيّر", "Changes")}>
                {diff.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted sm:px-5">{tr("لم تتغيّر بيانات حقول في هذه العملية.", "No field values changed in this action.")}</p>
                ) : (
                  <div className="px-4 sm:px-5">
                    <table className="w-full table-fixed border-collapse text-sm">
                      <caption className="sr-only">{tr("ما تغيّر: قبل وبعد", "What changed: before and after")}</caption>
                      <thead>
                        <tr className="text-xs text-muted">
                          <th scope="col" className="w-[30%] py-1.5 pe-2 text-start font-medium">
                            {tr("الحقل", "Field")}
                          </th>
                          <th scope="col" className="py-1.5 pe-2 text-start font-medium">
                            {tr("قبل", "Before")}
                          </th>
                          <th scope="col" className="py-1.5 text-start font-medium">
                            {tr("بعد", "After")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.map((r) => (
                          <tr key={r.field} className="border-t border-line align-top">
                            <th scope="row" className="py-2 pe-2 text-start font-medium break-words">
                              {fieldName(r.field, tr)}
                            </th>
                            {r.type === "value" ? (
                              <>
                                <td className="py-2 pe-2 break-words">
                                  {r.from ? <bdi className="rounded bg-danger-soft px-1 text-danger">{valueWords(r.field, r.from, tr)}</bdi> : <Empty />}
                                </td>
                                <td className="py-2 break-words">
                                  {r.to ? <bdi className="rounded bg-success-soft px-1 text-success">{valueWords(r.field, r.to, tr)}</bdi> : <Empty />}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-2 pe-2 break-words">
                                  <Marked items={r.removed} sign="−" word={tr("أُزيل", "Removed")} className="text-danger" />
                                </td>
                                <td className="py-2 break-words">
                                  <Marked items={r.added} sign="+" word={tr("أُضيف", "Added")} className="text-success" />
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* The context: the same person that day, and everything about the same subject. */}
              <section aria-label={tr("السياق", "Context")} className="border-t border-line pb-6">
                <div role="tablist" aria-label={tr("السياق", "Context")} className="flex gap-1 border-b border-line px-3 sm:px-4">
                  {(
                    [
                      ["actor", tr("عمليات الشخص في ذلك اليوم", "Same person that day"), detail?.related_by_actor],
                      ["target", tr("تاريخ هذا العنصر", "History of this subject"), detail?.related_by_target],
                    ] as const
                  ).map(([key, label, rows]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      id={`audit-ctx-${key}`}
                      aria-controls="audit-ctx-panel"
                      aria-selected={tab === key}
                      onClick={() => setTab(key)}
                      className={cn(
                        "-mb-px flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-[13px] whitespace-nowrap",
                        tab === key ? "border-accent font-semibold text-text" : "border-transparent text-muted hover:text-text",
                      )}
                    >
                      {label}
                      {rows && <span className="rounded bg-chip px-1.5 text-[11px] font-medium text-muted tabular-nums">{rows.length}</span>}
                    </button>
                  ))}
                </div>
                <div id="audit-ctx-panel" role="tabpanel" aria-labelledby={`audit-ctx-${tab}`} className="px-2 pt-2 sm:px-3">
                  {!detail && load.state.status === "error" ? (
                    <ErrorBox error={load.state.error} onRetry={load.reload} />
                  ) : !detail ? (
                    <Skeleton className="m-2 h-24" />
                  ) : (
                    <Related
                      rows={tab === "actor" ? detail.related_by_actor : detail.related_by_target}
                      empty={
                        tab === "actor"
                          ? entry.actor_id === undefined
                            ? tr("لا شخص لهذا السطر.", "This line has no person.")
                            : tr("لا عمليات أخرى لهذا الشخص في ذلك اليوم.", "No other actions by this person that day.")
                          : tr("لا أسطر أخرى عن هذا العنصر.", "No other lines about this subject.")
                      }
                      who={(e) => (e.actor_id === undefined ? tr("محاولة دخول", "Sign-in attempt") : nameOf(person(e.actor_id)))}
                      actionOf={actionOf}
                      onSelect={onSelect}
                    />
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

function ToolButton({ label, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-card-2 hover:text-text disabled:pointer-events-none disabled:opacity-35", className)}
      {...props}
    />
  );
}

/** A sign-in attempt has no person: a plain round mark in their place (red when it failed). */
function NoOne({ failed }: { failed: boolean }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full", failed ? "bg-danger-soft text-danger" : "bg-chip text-muted")}>
      <ShieldX size={18} />
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-1">
      <h3 className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase sm:px-5">{title}</h3>
      {children}
    </section>
  );
}

/** One fact: its name and its value, side by side (one above the other on a narrow phone). */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 px-4 py-1.5 text-sm sm:grid-cols-[9rem_1fr] sm:px-5">
      <span className="text-muted">{label}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

const Empty = () => <span className="text-faint">—</span>;

/** A list's removed (−) or added (+) items; the sign is said in words to a screen reader. */
function Marked({ items, sign, word, className }: { items: string[]; sign: string; word: string; className: string }) {
  if (!items.length) return <Empty />;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((x) => (
        <li key={x} className={cn("flex gap-1.5", className)}>
          <span aria-hidden="true" className="font-mono">
            {sign}
          </span>
          <span className="sr-only">{word}: </span>
          <bdi>{x}</bdi>
        </li>
      ))}
    </ul>
  );
}

/** A short list of other lines; each one switches the panel to it. */
function Related({
  rows,
  empty,
  who,
  actionOf,
  onSelect,
}: {
  rows: AuditEntry[];
  empty: string;
  who: (e: AuditEntry) => string;
  actionOf: (e: AuditEntry) => string;
  onSelect: (id: number) => void;
}) {
  const { dateTime } = useFmt();
  if (!rows.length) return <p className="px-2 py-3 text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {rows.map((e) => (
        <li key={e.id}>
          <button type="button" onClick={() => onSelect(e.id)} className="flex w-full items-baseline gap-3 rounded-md px-2 py-2 text-start text-sm hover:bg-card-2">
            <time dateTime={e.at} className="w-28 shrink-0 text-xs text-muted tabular-nums">
              {dateTime(e.at)}
            </time>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{who(e)}</span> <span className="text-muted">{actionOf(e)}:</span> <bdi>{e.target.label}</bdi>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
