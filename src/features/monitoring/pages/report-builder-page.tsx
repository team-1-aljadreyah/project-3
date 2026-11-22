import { ArrowRight, Calculator, FolderKanban, Printer, Save, Send, User as UserIcon, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminApi } from "@/features/admin";
import { authApi } from "@/features/auth";
import { PeriodPicker, presetPeriods } from "@/features/performance";
import { projectsApi } from "@/features/projects";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn, today } from "@/shared/lib/utils";
import { Button, ButtonLink, Empty, ErrorBox, Field, Input, LoadingBlock, PeoplePicker, Pill, ProgressBar, Select, Skeleton, Stat, Textarea, errorText, useToast } from "@/shared/ui";
import { monitoringApi } from "../api";
import { againstPlan, draftSummary } from "../report";
import { canWriteNotes, NOTE_LIMITS as L } from "../rules";
import type { ReportFacts, ReportPeriod } from "../types";

type AboutType = "team" | "person" | "project";

const TYPES: { key: AboutType; icon: typeof Users; ar: string; en: string; pick: [string, string] }[] = [
  { key: "team", icon: Users, ar: "فريق", en: "A team", pick: ["الفريق", "Team"] },
  { key: "person", icon: UserIcon, ar: "شخص", en: "A person", pick: ["الشخص", "Person"] },
  { key: "project", icon: FolderKanban, ar: "مشروع", en: "A project", pick: ["المشروع", "Project"] },
];

const PLAN = {
  ahead: { ar: "متقدم على الخطة", en: "Ahead of plan", tone: "done" },
  on: { ar: "وفق الخطة", en: "On plan", tone: "progress" },
  behind: { ar: "متأخر عن الخطة", en: "Behind plan", tone: "blocked" },
} as const;

/**
 * The monitoring officer's report builder: she picks a team, a person or a project and a period; the platform counts
 * the numbers (tasks done, late, blocked, progress against the plan, bugs) and writes a first draft; she edits it, adds
 * her comments, and saves it, prints it (or saves it as a PDF), or sends it to whom she chooses: the CEO and/or anyone else.
 */
export function ReportBuilderPage() {
  const fmt = useFmt();
  const { tr, num, pct, day, dateTime, lang } = fmt;
  usePageTitle(tr("صانع التقارير", "Report builder"));
  const user = useUser();
  const toast = useToast();
  const router = useRouter();
  const allowed = canWriteNotes(user);
  const load = useLoad(() => (allowed ? Promise.all([adminApi.teams(), authApi.users(), projectsApi.projects()]) : Promise.resolve(null)), [allowed]);
  const [type, setType] = useState<AboutType>("team");
  const [id, setId] = useState("");
  const [period, setPeriod] = useState<ReportPeriod>(() => presetPeriods(today()).d30);
  const [facts, setFacts] = useState<ReportFacts | null>(null);
  const [counting, setCounting] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [comments, setComments] = useState("");
  // Once she changes the title or the draft herself, counting again keeps her words.
  const [edited, setEdited] = useState({ title: false, summary: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  // Who receives it: the CEO (her inbox) and/or anyone else (their "Received" list).
  const [toCeo, setToCeo] = useState(true);
  const [shareIds, setShareIds] = useState<number[]>([]);

  if (!allowed) return <Empty title={tr("صانع التقارير لمسؤول المتابعة والتقييم", "The report builder is for the monitoring officer")} />;
  if (load.state.status === "loading") {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  if (!load.data) return null;
  const [teams, users, projects] = load.data;
  const nameOf = (x: { name: string; name_en?: string }) => (lang === "en" && x.name_en ? x.name_en : x.name);
  const choices =
    type === "team"
      ? teams.map((t) => ({ id: t.id, label: nameOf(t) }))
      : type === "person"
        ? users.filter((u) => u.active && u.role !== "admin").map((u) => ({ id: u.id, label: nameOf(u) }))
        : projects.map((p) => ({ id: p.id, label: nameOf(p) }));
  const current = TYPES.find((t) => t.key === type)!;
  // The numbers on screen are for another choice than the one picked now.
  const stale = !!facts && (facts.about.type !== type || String(facts.about.id) !== id || facts.period.from !== period.from || facts.period.to !== period.to);
  const aboutName = (f: ReportFacts) => (lang === "en" && f.about.label_en) || f.about.label || "";

  const count = async () => {
    if (!id) return setErrors({ about: tr(`اختر ${current.pick[0]}.`, `Choose the ${current.pick[1].toLowerCase()}.`) });
    setErrors({});
    setCounting(true);
    try {
      const f = await monitoringApi.reportFacts({ type, id: Number(id) }, period);
      setFacts(f);
      if (!edited.title) setTitle(tr(`تقرير ${aboutName(f)}: ${day(f.period.from)} – ${day(f.period.to)}`, `Report on ${aboutName(f)}: ${day(f.period.from)} – ${day(f.period.to)}`));
      if (!edited.summary) setSummary(draftSummary(f, fmt));
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      else toast(errorText(e, tr));
    } finally {
      setCounting(false);
    }
  };

  const body = () => (comments.trim() ? `${summary.trim()}\n\n${tr("ملاحظاتي وتوصياتي:", "My comments and recommendations:")}\n${comments.trim()}` : summary.trim());

  const save = async (send: boolean) => {
    if (!facts) return;
    const problems: Record<string, string> = {};
    if (!title.trim()) problems.title = tr("اكتب عنواناً.", "Enter a title.");
    if (!summary.trim()) problems.summary = tr("اكتب نص التقرير.", "Write the report's text.");
    if (body().length > L.body) problems.comments = tr("التقرير أطول من المسموح: اختصر قليلاً.", "The report is too long: shorten it a little.");
    if (Object.keys(problems).length) return setErrors(problems);
    setBusy(send ? "send" : "save");
    try {
      await monitoringApi.create({
        kind: "report",
        title: title.trim(),
        body: body(),
        about: { type: facts.about.type, id: facts.about.id },
        period: facts.period,
        send: send && toCeo,
        ...(send && shareIds.length ? { share_ids: shareIds } : {}),
      });
      const to = [send && toCeo ? tr("المدير التنفيذي", "the CEO") : "", send && shareIds.length ? tr(`${num(shareIds.length)} أشخاص آخرين`, `${num(shareIds.length)} other people`) : ""].filter(Boolean);
      toast(to.length ? tr(`حُفظ التقرير وأُرسل إلى ${to.join(" و")}.`, `The report was saved and sent to ${to.join(" and ")}.`) : tr("حُفظ التقرير.", "The report was saved."));
      router.push("/monitoring");
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors({ ...e.errors, ...(e.errors.body ? { summary: e.errors.body } : {}) });
      else toast(errorText(e, tr));
      setBusy(null);
    }
  };

  const plan = facts && againstPlan(facts);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tr("صانع التقارير", "Report builder")}</h1>
          <p className="text-sm text-muted">
            {tr("اختاري فريقاً أو شخصاً أو مشروعاً وفترة، وتُحسب الأرقام وحدها. عدّلي النص وأضيفي ملاحظاتك.", "Pick a team, a person or a project and a period; the numbers are counted for you. Edit the text and add your comments.")}
          </p>
        </div>
        <ButtonLink href="/monitoring" variant="secondary" size="sm" pill>
          <ArrowRight size={15} aria-hidden="true" className="ltr:rotate-180" />
          {tr("المتابعة", "Monitoring")}
        </ButtonLink>
      </div>

      {/* 1. What the report is about, and the period. */}
      <section aria-labelledby="rb-choose" className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 sm:p-5 print:hidden">
        <h2 id="rb-choose" className="text-base font-semibold">
          {tr("عن ماذا التقرير، ولأي فترة؟", "What is the report about, and for which period?")}
        </h2>
        <div role="radiogroup" aria-label={tr("نوع التقرير", "Report type")} className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={type === t.key}
              onClick={() => {
                setType(t.key);
                setId("");
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
                type === t.key ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-line text-muted hover:border-accent hover:text-text",
              )}
            >
              <t.icon size={16} aria-hidden="true" />
              {tr(t.ar, t.en)}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr(current.pick[0], current.pick[1])} htmlFor="rb-about" error={errors.about}>
            <Select id="rb-about" value={id} invalid={!!errors.about} onChange={(e) => setId(e.target.value)}>
              <option value="">{tr("اختر…", "Choose…")}</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <div role="group" aria-labelledby="rb-period" className="flex flex-col gap-1.5">
            <span id="rb-period" className="text-sm font-medium">
              {tr("الفترة", "Period")}
            </span>
            <PeriodPicker value={period} onChange={setPeriod} today={today()} />
            {errors.period && <p className="text-[13px] text-danger">{errors.period}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button pill onClick={count} disabled={counting}>
            <Calculator size={16} aria-hidden="true" />
            {counting ? tr("جارٍ الحساب…", "Counting…") : facts ? tr("احسب الأرقام مرة أخرى", "Count again") : tr("احسب الأرقام", "Count the numbers")}
          </Button>
          {stale && (
            <p role="status" className="text-sm text-danger">
              {tr("غيّرتِ الاختيار: احسبي الأرقام مرة أخرى قبل الحفظ.", "You changed the choice: count again before saving.")}
            </p>
          )}
        </div>
      </section>

      {/* 2. The report: counted numbers, the draft she edits, and her comments. */}
      {facts && (
        <article aria-label={tr("التقرير", "The report")} className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-4 sm:p-5 print:border-0 print:p-0">
          <div className="flex flex-col gap-1">
            <div className="print:hidden">
              <Field label={tr("عنوان التقرير", "Report title")} htmlFor="rb-title" error={errors.title}>
                <Input
                  id="rb-title"
                  dir="auto"
                  maxLength={L.title}
                  value={title}
                  invalid={!!errors.title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setEdited((x) => ({ ...x, title: true }));
                  }}
                />
              </Field>
            </div>
            <h2 dir="auto" className="hidden text-xl font-semibold print:block">
              {title}
            </h2>
            <p className="text-xs text-muted">
              {aboutName(facts)} · {day(facts.period.from)} – {day(facts.period.to)} · {tr("حُسبت", "Counted")} {dateTime(facts.counted_at)}
            </p>
          </div>

          <ul aria-label={tr("الأرقام", "The numbers")} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <li>
              <Stat label={tr("المهام في الفترة", "Tasks in the period")} value={num(facts.assigned)} note={tr(`المتبقي ${num(facts.left)}`, `${num(facts.left)} left`)} />
            </li>
            <li>
              <Stat label={tr("المنجزة", "Done")} value={num(facts.done)} note={pct(facts.completion)} />
            </li>
            <li>
              <Stat label={tr("في موعدها", "On time")} value={facts.on_time === null ? "-" : pct(facts.on_time)} note={tr("من المنجزة ذات الموعد", "of the done tasks with a due day")} />
            </li>
            <li>
              <Stat label={tr("المتأخرة", "Late")} value={num(facts.late)} danger={facts.late > 0} />
            </li>
            <li>
              <Stat label={tr("المتوقفة الآن", "Blocked now")} value={num(facts.blocked)} danger={facts.blocked > 0} />
            </li>
            <li>
              <Stat
                label={tr("الأخطاء المفتوحة", "Open bugs")}
                value={num(facts.bugs_open)}
                note={tr(`أُبلغ ${num(facts.bugs_reported)} · أُغلق ${num(facts.bugs_closed)}`, `${num(facts.bugs_reported)} reported · ${num(facts.bugs_closed)} closed`)}
              />
            </li>
          </ul>

          {/* Progress against the plan: the bar is the work done, the mark is where the plan says it should be. */}
          <div className="flex flex-col gap-2 rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">{tr("الإنجاز مقابل الخطة", "Progress against the plan")}</span>
              {plan && <Pill tone={PLAN[plan].tone}>{tr(PLAN[plan].ar, PLAN[plan].en)}</Pill>}
            </div>
            <ProgressBar value={facts.completion} planned={facts.planned ?? undefined} label={tr("الإنجاز مقابل الخطة", "Progress against the plan")} />
            <p className="text-xs text-muted">
              {tr("الفعلي", "Actual")} <b className="num text-text">{pct(facts.completion)}</b>
              {facts.planned !== null && (
                <>
                  {" · "}
                  {tr("المتوقع حسب مواعيد المشاريع", "Planned by the projects' dates")} <b className="num text-text">{pct(facts.planned)}</b>
                </>
              )}
            </p>
          </div>

          {facts.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="pb-2 text-start font-medium">{facts.about.type === "person" ? tr("حسب المشروع", "By project") : tr("حسب الشخص", "By person")}</caption>
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 text-start font-medium">
                      {facts.about.type === "person" ? tr("المشروع", "Project") : tr("الاسم", "Name")}
                    </th>
                    <th scope="col" className="px-2 py-2 text-center font-medium">{tr("المهام", "Tasks")}</th>
                    <th scope="col" className="px-2 py-2 text-center font-medium">{tr("المنجزة", "Done")}</th>
                    <th scope="col" className="px-2 py-2 text-center font-medium">{tr("المتأخرة", "Late")}</th>
                    <th scope="col" className="px-2 py-2 text-center font-medium">{tr("المتوقفة", "Blocked")}</th>
                    <th scope="col" className="w-40 py-2 text-start font-medium">{tr("الإنجاز", "Completion")}</th>
                  </tr>
                </thead>
                <tbody>
                  {facts.rows.map((r) => {
                    const label = (lang === "en" && r.label_en) || r.label;
                    return (
                      // The whole row opens the person's performance or the project (its name is the link).
                      <tr key={`${r.type}-${r.id}`} className="relative border-b border-line last:border-0 hover:bg-card-2">
                        <th scope="row" className="py-2.5 text-start font-medium">
                          <Link href={r.type === "person" ? `/performance/${r.id}` : `/projects/${r.id}`} dir="auto" className="after:absolute after:inset-0 hover:underline">
                            {label}
                          </Link>
                        </th>
                        <td className="num px-2 text-center">{num(r.assigned)}</td>
                        <td className="num px-2 text-center">{num(r.done)}</td>
                        <td className={cn("num px-2 text-center", r.late > 0 && "text-danger")}>{num(r.late)}</td>
                        <td className={cn("num px-2 text-center", r.blocked > 0 && "text-danger")}>{num(r.blocked)}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={r.completion} label={tr(`إنجاز ${label}`, `${label}'s completion`)} className="flex-1" />
                            <span className="num w-10 text-xs text-muted">{pct(r.completion)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="print:hidden">
              <Field label={tr("نص التقرير", "The report")} hint={tr("كُتب من الأرقام، عدّليه كما تشائين.", "Written from the numbers; change it as you like.")} htmlFor="rb-summary" error={errors.summary}>
                <Textarea
                  id="rb-summary"
                  dir="auto"
                  rows={8}
                  maxLength={L.body}
                  value={summary}
                  invalid={!!errors.summary}
                  onChange={(e) => {
                    setSummary(e.target.value);
                    setEdited((x) => ({ ...x, summary: true }));
                  }}
                />
              </Field>
            </div>
            <div className="print:hidden">
              <Field label={tr("ملاحظاتي وتوصياتي", "My comments and recommendations")} hint={tr("اختياري.", "Optional.")} htmlFor="rb-comments" error={errors.comments}>
                <Textarea id="rb-comments" dir="auto" rows={4} maxLength={L.body} value={comments} invalid={!!errors.comments} onChange={(e) => setComments(e.target.value)} />
              </Field>
            </div>
            {/* What prints: her words as plain text. */}
            <p dir="auto" className="hidden text-sm leading-relaxed whitespace-pre-line print:block">
              {body()}
            </p>
          </div>

          {/* Who receives it: not only the CEO. Nobody chosen: "Save" keeps it, to send later from the list. */}
          <fieldset className="flex flex-col gap-2 rounded-xl border border-line p-3 print:hidden">
            <legend className="px-1 text-sm font-medium">{tr("أرسليه إلى", "Send it to")}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={toCeo} onChange={(e) => setToCeo(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              {tr("المدير التنفيذي", "The CEO")}
            </label>
            <PeoplePicker
              people={users.filter((u) => u.active && u.id !== user.id && u.role !== "ceo")}
              value={shareIds}
              onChange={setShareIds}
              error={errors.share_ids}
              legend={{ ar: "وأشخاص آخرون (اختياري)", en: "And other people (optional)" }}
            />
          </fieldset>

          <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-4 print:hidden">
            <Button variant="secondary" pill onClick={() => window.print()} title={tr("اختاري «حفظ بصيغة PDF» في نافذة الطباعة لتنزيله.", "Choose \"Save as PDF\" in the print window to download it.")}>
              <Printer size={16} aria-hidden="true" />
              {tr("اطبع أو احفظ PDF", "Print or save as PDF")}
            </Button>
            <span className="ms-auto flex flex-wrap gap-2">
              <Button variant="secondary" pill onClick={() => save(false)} disabled={!!busy || stale}>
                <Save size={16} aria-hidden="true" />
                {busy === "save" ? tr("جارٍ الحفظ…", "Saving…") : tr("احفظ", "Save")}
              </Button>
              <Button pill onClick={() => save(true)} disabled={!!busy || stale || (!toCeo && !shareIds.length)}>
                <Send size={16} aria-hidden="true" />
                {busy === "send"
                  ? tr("جارٍ الإرسال…", "Sending…")
                  : toCeo && !shareIds.length
                    ? tr("احفظ وأرسل إلى المدير التنفيذي", "Save and send to the CEO")
                    : tr("احفظ وأرسل", "Save and send")}
              </Button>
            </span>
          </footer>
        </article>
      )}
    </div>
  );
}
