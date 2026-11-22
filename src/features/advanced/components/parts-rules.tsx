// The parts made of plain settings: working time, tasks and approvals, features, sign-in and security, code prefixes.
import { CalendarDays, CalendarOff, Hash, KeyRound, ListChecks, Plus, ShieldCheck, Timer, ToggleRight, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Button, Input, Pill } from "@/shared/ui";
import { useFmt } from "@/shared/lib/i18n";
import { APPROVERS, CODE_KINDS, DEFAULT_RULES as D, FEATURES, LIMITS, PRIORITIES, SEVERITIES, SEVERITY_WORDS, WEEK } from "../rules";
import type { AdvancedRules, Holiday } from "../types";
import { Chips, type Ctx, FlagRow, Note, NumRow, Part, Row, same, Segmented } from "./controls";

/** A small label on parts that are saved now and take effect in a later version. */
export function Later() {
  const { tr } = useFmt();
  return (
    <Pill tone="new" className="mt-0.5">
      {tr("يُحفظ الآن، ويُطبَّق لاحقاً", "Saved now, applies later")}
    </Pill>
  );
}

/** A small label on parts that already change the platform. */
export function Live() {
  const { tr } = useFmt();
  return (
    <Pill tone="done" className="mt-0.5">
      {tr("يسري فور الحفظ", "Applies on save")}
    </Pill>
  );
}

const icon = (I: typeof CalendarDays) => <I size={17} aria-hidden="true" className="text-accent" />;

// ---------- working time ----------

export function WorkPart(c: Ctx) {
  const { tr, r } = c;
  const w = r.work;
  const setWork = (p: Partial<AdvancedRules["work"]>) => c.set({ work: { ...w, ...p } });
  const dayNames = (days: number[]) => WEEK.filter((d) => days.includes(d.day)).map((d) => tr(d.ar, d.en)).join(tr("، ", ", "));
  const hoursId = useId();
  const daysId = useId();
  const PRI: Record<string, [string, string]> = { high: ["عالية", "High"], medium: ["متوسطة", "Medium"], low: ["منخفضة", "Low"] };
  const wd = tr("يوم عمل", "work days");

  return (
    <div className="flex flex-col gap-5">
      <Part title={tr("أيام الدوام وساعاته", "Working days and hours")} sub={tr("منها تُحسب مواعيد التسليم ومهل الإصلاح بأيام العمل", "Due dates and fix targets count working days from these")} icon={icon(CalendarDays)} action={<Later />}>
        <Row
          label={tr("أيام العمل", "Working days")}
          hint={tr("الجمعة والسبت عطلة في الأصل", "Friday and Saturday are off by default")}
          changed={!same([...w.days].sort(), [...D.work.days].sort())}
          onDefault={() => setWork({ days: D.work.days })}
          defText={dayNames(D.work.days)}
          error={c.errors["work.days"]}
          errorId={daysId}
        >
          <Chips label={tr("أيام العمل", "Working days")} value={w.days} options={WEEK.map((d) => ({ v: d.day, l: tr(d.ar, d.en) }))} onChange={(days) => setWork({ days })} />
        </Row>
        <Row
          label={tr("ساعات الدوام", "Working hours")}
          hint={tr("من بداية الدوام إلى نهايته", "From the start of the day to its end")}
          changed={w.from !== D.work.from || w.to !== D.work.to}
          onDefault={() => setWork({ from: D.work.from, to: D.work.to })}
          defText={`${D.work.from} - ${D.work.to}`}
          error={c.errors["work.hours"]}
          errorId={hoursId}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              {tr("من", "From")}
              <Input type="time" dir="ltr" value={w.from} onChange={(e) => setWork({ from: e.target.value })} invalid={!!c.errors["work.hours"]} aria-describedby={c.errors["work.hours"] ? hoursId : undefined} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              {tr("إلى", "To")}
              <Input type="time" dir="ltr" value={w.to} onChange={(e) => setWork({ to: e.target.value })} invalid={!!c.errors["work.hours"]} aria-describedby={c.errors["work.hours"] ? hoursId : undefined} />
            </label>
          </div>
        </Row>
      </Part>

      <Holidays c={c} />

      <Part title={tr("موعد المهمة حسب أولويتها", "Due date by priority")} sub={tr("الموعد المقترح لمهمة جديدة، بأيام العمل", "The suggested due date of a new task, in working days")} icon={icon(Timer)} action={<Later />}>
        {PRIORITIES.map((p) => (
          <NumRow
            key={p}
            c={c}
            field={`due_days.${p}`}
            label={tr(`أولوية ${PRI[p][0]}`, `${PRI[p][1]} priority`)}
            value={r.due_days[p]}
            def={D.due_days[p]}
            put={(v) => c.set({ due_days: { ...r.due_days, [p]: v } })}
            unit={wd}
          />
        ))}
      </Part>

      <Part title={tr("مهلة إصلاح المشكلات", "Bug fix targets")} sub={tr("«أصلحها خلال N يوم عمل» حسب خطورة المشكلة", "\"Fix within N working days\" by the bug's severity")} icon={icon(Wrench)} action={<Later />}>
        {SEVERITIES.map((s) => (
          <NumRow
            key={s}
            c={c}
            field={`fix_days.${s}`}
            label={tr(`مشكلة ${SEVERITY_WORDS[s].ar}`, `${SEVERITY_WORDS[s].en} bug`)}
            hint={s === "critical" ? tr("الأخطر لا تنتظر أكثر من الأخف", "A worse bug never waits longer than a lighter one") : undefined}
            value={r.fix_days[s]}
            def={D.fix_days[s]}
            put={(v) => c.set({ fix_days: { ...r.fix_days, [s]: v } })}
            unit={wd}
          />
        ))}
      </Part>
    </div>
  );
}

/** The company's holidays: a list by date, with a small form to add one. */
function Holidays({ c }: { c: Ctx }) {
  const { tr, r } = c;
  const { day } = useFmt();
  const [v, setV] = useState({ date: "", name: "", name_en: "" });
  const list = [...r.work.holidays].sort((a, b) => a.date.localeCompare(b.date));
  const taken = r.work.holidays.some((h) => h.date === v.date);
  const ready = !!v.date && !!v.name.trim() && !taken && r.work.holidays.length < LIMITS.holidays;
  const errorId = useId();
  const put = (holidays: Holiday[]) => c.set({ work: { ...r.work, holidays } });
  const add = () => {
    if (!ready) return;
    put([...r.work.holidays, { date: v.date, name: v.name.trim(), ...(v.name_en.trim() ? { name_en: v.name_en.trim() } : {}) }]);
    setV({ date: "", name: "", name_en: "" });
  };

  return (
    <Part
      title={tr("العطل الرسمية", "Holidays")}
      sub={
        r.work.holidays.length
          ? tr(`أيام لا دوام فيها للشركة كلها. عدد العطل: ${r.work.holidays.length}`, `Days the whole company is off: ${r.work.holidays.length}`)
          : tr("أيام لا دوام فيها للشركة كلها", "Days the whole company is off")
      }
      icon={icon(CalendarOff)}
      action={<Later />}
    >
      <Row
        wide
        label={tr("قائمة العطل", "The list")}
        changed={!same(r.work.holidays, D.work.holidays)}
        onDefault={() => put(D.work.holidays)}
        defText={tr("بلا عطل", "None")}
        error={c.errors["work.holidays"]}
        errorId={errorId}
      >
        {list.length ? (
          <ul aria-label={tr("العطل الرسمية", "Holidays")} className="mb-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
            {list.map((h) => (
              <li key={h.date} className="flex items-center gap-3 bg-card-2 px-3 py-2">
                <span className="num w-28 shrink-0 text-[13px] text-muted">{day(h.date)}</span>
                <span dir="auto" className="min-w-0 flex-1 truncate text-sm font-medium">
                  {tr(h.name, h.name_en || h.name)}
                </span>
                <button
                  type="button"
                  onClick={() => put(r.work.holidays.filter((x) => x.date !== h.date))}
                  aria-label={tr(`احذف عطلة ${h.name}`, `Remove the holiday ${h.name_en || h.name}`)}
                  className="rounded-full p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 rounded-xl border border-dashed border-line-strong/60 px-4 py-3 text-center text-[13px] text-muted">{tr("لا عطل بعد. أضف أول عطلة بالأسفل.", "No holidays yet. Add the first one below.")}</p>
        )}
        <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input type="date" dir="ltr" aria-label={tr("تاريخ العطلة", "The holiday's date")} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} invalid={taken} />
          <Input aria-label={tr("اسم العطلة", "The holiday's name")} placeholder={tr("مثلاً: عيد الفطر", "e.g. Eid al-Fitr")} value={v.name} maxLength={LIMITS.holidayName} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <Input dir="ltr" aria-label={tr("الاسم بالإنجليزية (اختياري)", "Name in English (optional)")} placeholder={tr("بالإنجليزية (اختياري)", "In English (optional)")} value={v.name_en} maxLength={LIMITS.holidayName} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
          <Button variant="secondary" onClick={add} disabled={!ready} className="h-11">
            <Plus size={16} aria-hidden="true" />
            {tr("أضف العطلة", "Add the holiday")}
          </Button>
        </div>
        {taken && <p className="mt-1.5 text-xs font-medium text-danger">{tr("في هذا اليوم عطلة من قبل", "There is a holiday on that day already")}</p>}
      </Row>
    </Part>
  );
}

// ---------- tasks and approvals ----------

export function TasksPart(c: Ctx) {
  const { tr, r } = c;
  const t = r.tasks;
  const setT = (p: Partial<AdvancedRules["tasks"]>) => c.set({ tasks: { ...t, ...p } });
  const defApprover = APPROVERS.find((a) => a.key === D.tasks.approver)!;
  return (
    <div className="flex flex-col gap-5">
      <Part title={tr("اعتماد المهام", "Approving tasks")} sub={tr("من يقول إن المهمة انتهت فعلاً", "Who says a task is really done")} icon={icon(ListChecks)} action={<Later />}>
        <Row
          label={tr("من يعتمد إكمال المهمة", "Who approves a task as done")}
          hint={tr("المدير التنفيذي يعتمد دائماً", "The CEO always may")}
          changed={t.approver !== D.tasks.approver}
          onDefault={() => setT({ approver: D.tasks.approver })}
          defText={tr(defApprover.ar, defApprover.en)}
          error={c.errors["tasks.approver"]}
        >
          <Segmented label={tr("من يعتمد إكمال المهمة", "Who approves a task as done")} value={t.approver} options={APPROVERS.map((a) => ({ v: a.key, l: tr(a.ar, a.en) }))} onChange={(approver) => setT({ approver })} />
        </Row>
        <FlagRow
          c={c}
          label={tr("يعيد الموظف فتح مهمته المنتهية", "An employee may reopen their finished task")}
          hint={tr("متوقف: يعيدها مدير القسم أو قائد الفريق فقط", "Off: only the department manager or a team leader moves it back")}
          value={t.employee_reopen}
          def={D.tasks.employee_reopen}
          put={(employee_reopen) => setT({ employee_reopen })}
        />
      </Part>
      <Part title={tr("المواعيد والحدود", "Due dates and limits")} icon={icon(Timer)} action={<Later />}>
        <FlagRow
          c={c}
          label={tr("سبب مطلوب عند تغيير موعد التسليم", "A reason is needed to change a due date")}
          hint={tr("يُكتب في سجل المهمة ويصل صاحبها مع الإشعار", "It goes in the task's history and to its person with the notification")}
          value={t.due_reason}
          def={D.tasks.due_reason}
          put={(due_reason) => setT({ due_reason })}
        />
        <NumRow
          c={c}
          field="tasks.wip_limit"
          label={tr("أكثر عدد مهام قيد التنفيذ للشخص", "Most tasks in progress per person")}
          hint={tr("0 = بلا حد. بعده لا يبدأ مهمة جديدة حتى ينهي واحدة", "0 = no limit. Past it, a person finishes one before starting another")}
          value={t.wip_limit}
          def={D.tasks.wip_limit}
          put={(wip_limit) => setT({ wip_limit })}
          unit={tr("مهمة", "tasks")}
        />
      </Part>
    </div>
  );
}

// ---------- features ----------

export function FeaturesPart(c: Ctx) {
  const { tr, r } = c;
  const off = FEATURES.filter((f) => !r.features[f.key]).length;
  return (
    <div className="flex flex-col gap-5">
      <Note>{tr("الميزة المتوقفة تختفي من القائمة للجميع إلا أنت، ويرفضها الخادم. ما فيها من بيانات يبقى كما هو، ويعود حين تشغّلها.", "A feature that is off leaves the menu for everyone but you, and the server refuses it. Its data stays as it is and comes back when you switch it on.")}</Note>
      <Part
        title={tr("الميزات", "Features")}
        sub={off ? tr(`${off} من ${FEATURES.length} متوقفة`, `${off} of ${FEATURES.length} off`) : tr(`كلها مفعّلة (${FEATURES.length})`, `All ${FEATURES.length} on`)}
        icon={icon(ToggleRight)}
        action={<Live />}
      >
        {FEATURES.map((f) => (
          <FlagRow
            key={f.key}
            c={c}
            label={tr(f.ar, f.en)}
            hint={tr(f.hint_ar, f.hint_en)}
            value={r.features[f.key]}
            def={D.features[f.key]}
            put={(v) => c.set({ features: { ...r.features, [f.key]: v } })}
          />
        ))}
      </Part>
    </div>
  );
}

// ---------- sign-in and security ----------

export function SecurityPart(c: Ctx) {
  const { tr, r } = c;
  const s = r.security;
  const put = (p: Partial<AdvancedRules["security"]>) => c.set({ security: { ...s, ...p } });
  return (
    <div className="flex flex-col gap-5">
      <Note>
        {tr("هذه الأرقام نفسها في ", "These are the same numbers as in ")}
        <Link href="/admin" className="font-semibold underline underline-offset-4">
          {tr("إدارة النظام", "Administration")}
        </Link>
        {tr(": تغييرها هنا يغيّرها هناك، والعكس.", ": changing them here changes them there, and the other way round.")}
      </Note>
      <Part title={tr("الدخول", "Signing in")} sub={tr("حماية الحسابات من تخمين كلمة المرور", "Protecting accounts from guessed passwords")} icon={icon(KeyRound)} action={<Live />}>
        <NumRow c={c} field="security.lock_after" label={tr("قفل الحساب بعد محاولات دخول خاطئة", "Lock an account after wrong passwords")} hint={tr("محاولات متتالية، من 3 إلى 10", "In a row, 3 to 10")} value={s.lock_after} def={D.security.lock_after} put={(lock_after) => put({ lock_after })} unit={tr("محاولة", "tries")} />
        <NumRow c={c} field="security.lock_minutes" label={tr("مدة القفل", "How long it stays locked")} hint={tr("من 5 إلى 120 دقيقة. يفتحه مسؤول النظام قبلها إن شاء", "5 to 120 minutes. The system admin may unlock it sooner")} value={s.lock_minutes} def={D.security.lock_minutes} put={(lock_minutes) => put({ lock_minutes })} unit={tr("دقيقة", "min")} />
      </Part>
      <Part title={tr("كلمات المرور", "Passwords")} icon={icon(ShieldCheck)} action={<Later />}>
        <NumRow c={c} field="security.password_min" label={tr("أقصر كلمة مرور مسموحة", "The shortest password allowed")} hint={tr("للكلمات الجديدة والمغيَّرة فقط، من 6 إلى 32 حرفاً", "New and changed ones only, 6 to 32 letters")} value={s.password_min} def={D.security.password_min} put={(password_min) => put({ password_min })} unit={tr("حرف", "letters")} />
      </Part>
      <Part title={tr("التذكير", "Reminders")} icon={icon(Timer)} action={<Live />}>
        <NumRow c={c} field="security.due_soon_days" label={tr("تذكير قرب موعد التسليم قبل", "Due-soon reminder, days before")} hint={tr("من 1 إلى 7 أيام", "1 to 7 days")} value={s.due_soon_days} def={D.security.due_soon_days} put={(due_soon_days) => put({ due_soon_days })} unit={tr("يوم", "days")} />
      </Part>
    </div>
  );
}

// ---------- code prefixes ----------

export function NamesPart(c: Ctx) {
  const { tr, r } = c;
  return (
    <div className="flex flex-col gap-5">
      <Part title={tr("بادئات الرموز", "Code prefixes")} sub={tr("للسجلات الجديدة فقط: الرموز القديمة لا تتغير", "New records only: old codes don't change")} icon={icon(Hash)} action={<Live />}>
        {CODE_KINDS.map((k) => (
          <PrefixRow key={k.key} c={c} kind={k} value={r.names[k.key]} def={D.names[k.key]} put={(v) => c.set({ names: { ...r.names, [k.key]: v } })} />
        ))}
      </Part>
    </div>
  );
}

function PrefixRow({ c, kind, value, def, put }: { c: Ctx; kind: (typeof CODE_KINDS)[number]; value: string; def: string; put: (v: string) => void }) {
  const { tr } = c;
  const errorId = useId();
  const error = c.errors[`names.${kind.key}`];
  return (
    <Row
      label={tr(kind.ar, kind.en)}
      hint={tr("من 2 إلى 5 أحرف إنجليزية كبيرة، ولكل نوع بادئة مختلفة", "2 to 5 capital letters, a different one for each kind")}
      changed={value !== def}
      onDefault={() => put(def)}
      defText={def}
      error={error}
      errorId={errorId}
    >
      <div className="flex items-center gap-3">
        <Input
          dir="ltr"
          aria-label={tr(`بادئة رموز ${kind.ar}`, `${kind.en} code prefix`)}
          value={value}
          maxLength={5}
          onChange={(e) => put(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
          invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="w-28 font-mono tracking-wider"
        />
        <span aria-label={tr("مثال", "Example")} dir="ltr" className={cn("num rounded-lg bg-chip/60 px-2.5 py-1 font-mono text-[13px] font-semibold", error ? "text-faint line-through" : "text-accent-ink")}>
          {(value || def)}-{kind.example}
        </span>
      </div>
    </Row>
  );
}
