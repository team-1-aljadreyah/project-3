import { arN, G } from "@/shared/lib/count-words";
import { CircleAlert, CircleCheck, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { useState } from "react";
import type { Team } from "@/shared/api/types";
import { ROLES } from "@/shared/lib/access";
import { downloadCsv } from "@/shared/lib/csv";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useQueryParam } from "@/shared/lib/query-param";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Button, ButtonLink, Empty, ErrorBox, errorText, Field, LoadingBlock, Skeleton, Textarea } from "@/shared/ui";
import { adminApi } from "../api";
import { IMPORT_COLUMNS, IMPORT_LIMIT, IMPORT_ROLES, PROBLEM_WORDS, roleFromText, rowsFromCsv, templateRows, type ParsedImport } from "../csv-import";
import { Panel } from "../components/panel";
import { canAdminister } from "../rules";
import type { ImportCheck, ImportResult, ImportRow } from "../types";

type Show = "all" | "ok" | "problems";
const SHOWS = ["all", "ok", "problems"] as const;

/**
 * Import accounts (/admin/import): paste or upload a CSV (name, English name, email, phone, job, title, team), see every
 * row checked by the server (a dry run: missing name, bad email, an email twice in the file or already used, an unknown
 * job or team), then create only the valid rows. The result says what was created and what was skipped, and why.
 */
export function ImportPage() {
  const { tr } = useFmt();
  usePageTitle(tr("استيراد حسابات", "Import accounts"));
  const me = useUser();
  const allowed = canAdminister(me);
  const teams = useLoad(() => (allowed ? adminApi.teams() : Promise.resolve([] as Team[])), [allowed]);

  if (!allowed) return <Empty title={tr("هذه الصفحة لمسؤول النظام والمدير التنفيذي", "This page is for the system admin and the CEO")} />;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tr("استيراد حسابات", "Import accounts")}</h1>
          <p className="text-sm text-muted">{tr("أضف عدة حسابات مرة واحدة من ملف CSV (من Excel أو Google Sheets).", "Add many accounts at once from a CSV file (from Excel or Google Sheets).")}</p>
        </div>
        <Button variant="secondary" onClick={() => downloadCsv("accounts-template.csv", templateRows())}>
          <Download size={16} aria-hidden="true" />
          {tr("نزّل نموذجاً", "Download a template")}
        </Button>
      </header>
      {teams.state.status === "loading" ? (
        <LoadingBlock>
          <Skeleton className="h-96 rounded-2xl" />
        </LoadingBlock>
      ) : teams.state.status === "error" ? (
        <ErrorBox error={teams.state.error} onRetry={teams.reload} />
      ) : (
        <Importer teams={teams.state.data} />
      )}
    </div>
  );
}

function Importer({ teams }: { teams: Team[] }) {
  const { tr, num, lang } = useFmt();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string>();
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [check, setCheck] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useQueryParam<Show>("show", "all", SHOWS);
  const step = result ? 3 : check ? 2 : 1;

  const readFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
    setParsed(null);
    setCheck(null);
  };

  const runCheck = async () => {
    setError(undefined);
    const p = rowsFromCsv(text);
    setParsed(p);
    setCheck(null);
    if (p.noHeader || p.missing.length || !p.rows.length || p.rows.length > IMPORT_LIMIT) return;
    setBusy(true);
    try {
      setCheck(await adminApi.importUsers(p.rows, true));
      setShow("all");
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!parsed) return;
    setError(undefined);
    setBusy(true);
    try {
      setResult(await adminApi.importUsers(parsed.rows, false));
    } catch (e) {
      setError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setText("");
    setFileName(undefined);
    setParsed(null);
    setCheck(null);
    setResult(null);
    setError(undefined);
    setShow("all");
  };

  const steps = [tr("الصق أو ارفع الملف", "Paste or upload"), tr("افحص الصفوف", "Check the rows"), tr("أنشئ الحسابات", "Create the accounts")];
  const ready = check ? check.rows.filter((r) => !r.problems.length).length : 0;
  const colName = (key: keyof ImportRow) => {
    const c = IMPORT_COLUMNS.find((x) => x.key === key)!;
    return tr(c.ar, c.en);
  };
  const teamName = (t: Team) => (lang === "en" && t.name_en ? t.name_en : t.name);

  return (
    <>
      <ol aria-label={tr("الخطوات", "Steps")} className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {steps.map((s, i) => (
          <li key={s} aria-current={step === i + 1 ? "step" : undefined} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="h-px w-6 bg-line-strong max-sm:hidden" />}
            <span className={cn("num inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold", step > i + 1 ? "bg-success text-card" : step === i + 1 ? "bg-accent text-on-accent" : "bg-chip text-muted")}>
              {num(i + 1)}
            </span>
            <span className={cn(step === i + 1 ? "font-semibold" : "text-muted")}>{s}</span>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {result ? (
        <ResultPanel result={result} rows={parsed?.rows ?? []} onRestart={restart} />
      ) : check && parsed ? (
        <Panel
          title={tr("معاينة الصفوف", "Preview")}
          note={tr(
            `${num(check.rows.length)} صف: ${num(ready)} جاهز و${num(check.rows.length - ready)} فيه مشكلة. تُنشأ الصفوف الجاهزة فقط.`,
            `${check.rows.length} rows: ${ready} ready and ${check.rows.length - ready} with problems. Only the ready rows are created.`,
          )}
          tools={
            <div role="group" aria-label={tr("الصفوف المعروضة", "Rows shown")} className="flex gap-1.5">
              {SHOWS.map((k) => (
                <Button key={k} size="sm" pill variant={show === k ? "primary" : "secondary"} aria-pressed={show === k} onClick={() => setShow(k)}>
                  {k === "all" ? tr("الكل", "All") : k === "ok" ? tr(`جاهزة ${num(ready)}`, `Ready ${ready}`) : tr(`فيها مشكلة ${num(check.rows.length - ready)}`, `Problems ${check.rows.length - ready}`)}
                </Button>
              ))}
            </div>
          }
        >
          {parsed.unknown.length > 0 && (
            <p className="border-b border-line px-4 py-2 text-xs text-muted">
              {tr("أُهملت أعمدة غير معروفة:", "Columns we don't know were left out:")} <bdi>{parsed.unknown.join("، ")}</bdi>
            </p>
          )}
          <PreviewTable rows={parsed.rows} checks={check.rows.filter((r) => (show === "all" ? true : show === "ok" ? !r.problems.length : r.problems.length > 0))} colName={colName} teams={teams} />
          <div className="flex flex-wrap items-center gap-3 border-t border-line bg-card-2 px-4 py-3">
            <Button onClick={create} disabled={busy || ready === 0}>
              {tr(`أنشئ ${arN(ready, G.account)}`, `Create ${ready} ${ready === 1 ? "account" : "accounts"}`)}
            </Button>
            <Button variant="secondary" onClick={() => setCheck(null)}>
              {tr("عدّل الملف", "Edit the file")}
            </Button>
            <span className="text-xs text-muted">{tr("تُترك الصفوف التي فيها مشكلة، ويُسجَّل كل شيء في سجل العمليات.", "Rows with problems are skipped; everything goes into the audit log.")}</span>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel title={tr("الملف", "The file")} note={tr("الصق محتوى الملف أو ارفعه. السطر الأول أسماء الأعمدة.", "Paste the file's content or upload it. The first line is the column names.")}>
            <div className="flex flex-col gap-4 p-4">
              <Field label={tr("محتوى ملف CSV", "CSV content")} htmlFor="import-text">
                <Textarea
                  id="import-text"
                  dir="auto"
                  rows={10}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setParsed(null);
                  }}
                  placeholder={"name,name_en,email,phone,job,title,team"}
                  className="font-mono text-[13px]"
                  spellCheck={false}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm font-medium hover:bg-card-2 focus-within:outline-2 focus-within:outline-accent">
                  <Upload size={16} aria-hidden="true" />
                  {tr("ارفع ملف CSV", "Upload a CSV file")}
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
                </label>
                {fileName && (
                  <span className="flex items-center gap-1.5 text-sm text-muted">
                    <FileSpreadsheet size={15} aria-hidden="true" />
                    <bdi>{fileName}</bdi>
                  </span>
                )}
                <Button className="ms-auto" onClick={runCheck} disabled={busy || !text.trim()}>
                  {tr("افحص الصفوف", "Check the rows")}
                </Button>
              </div>
              {parsed && <ParseProblems parsed={parsed} colName={colName} />}
            </div>
          </Panel>
          <Panel title={tr("الأعمدة", "The columns")} note={tr("بأي ترتيب، بالعربية أو الإنجليزية. ملف UTF-8.", "In any order, in Arabic or English. A UTF-8 file.")}>
            <dl className="divide-y divide-line text-sm">
              {IMPORT_COLUMNS.map((c) => (
                <div key={c.key} className="flex flex-col gap-0.5 px-4 py-2.5">
                  <dt className="flex items-center gap-2 font-medium">
                    {tr(c.ar, c.en)}
                    <code dir="ltr" className="rounded bg-chip px-1 text-xs text-muted">
                      {c.key === "role" ? "job" : c.key}
                    </code>
                    {c.required && <span className="text-xs text-danger">{tr("مطلوب", "Required")}</span>}
                  </dt>
                  <dd className="text-xs text-muted">
                    {c.key === "role"
                      ? tr(
                          `${IMPORT_ROLES.map((r) => ROLES[r].ar).join("، ")} (أو بالإنجليزية). الفارغ: موظف.`,
                          `${IMPORT_ROLES.map((r) => ROLES[r].en).join(", ")} (or in Arabic). Empty: employee.`,
                        )
                      : c.key === "team"
                        ? teams.length
                          ? tr(`اسم فريق موجود: ${teams.map(teamName).join("، ")}. الفارغ: بلا فريق.`, `An existing team: ${teams.map(teamName).join(", ")}. Empty: no team.`)
                          : tr("لا فرق بعد: اتركه فارغاً.", "No teams yet: leave it empty.")
                        : c.key === "email"
                          ? tr("فريد: لا يتكرر ولا يكون لحساب موجود.", "Unique: not twice, and not an existing account's.")
                          : c.key === "name"
                            ? tr("حتى 120 حرفاً.", "Up to 120 characters.")
                            : c.key === "title"
                              ? tr("حتى 80 حرفاً.", "Up to 80 characters.")
                              : c.key === "password"
                                ? tr("كلمة المرور الأولى للحساب، يغيّرها صاحبه من ملفه الشخصي. لا يُنشأ حساب بلا كلمة مرور.", "The account's first password; the person changes it in their profile. No account is made without one.")
                                : tr("اختياري.", "Optional.")}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
              {tr(`حتى ${num(IMPORT_LIMIT)} صف في المرة. المدير التنفيذي ومسؤول النظام لا يُستوردان.`, `Up to ${IMPORT_LIMIT} rows at a time. A CEO or a system admin is not imported.`)}
            </p>
          </Panel>
        </div>
      )}
    </>
  );
}

function ParseProblems({ parsed, colName }: { parsed: ParsedImport; colName: (k: keyof ImportRow) => string }) {
  const { tr, num } = useFmt();
  const box = "flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger";
  if (parsed.noHeader) {
    return (
      <p role="alert" className={box}>
        <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        {tr("لم نجد أسماء الأعمدة في السطر الأول. نزّل النموذج وانسخ سطره الأول.", "The first line has no column names we know. Download the template and copy its first line.")}
      </p>
    );
  }
  if (parsed.missing.length) {
    return (
      <p role="alert" className={box}>
        <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        {tr(`عمود مطلوب غير موجود: ${parsed.missing.map(colName).join("، ")}.`, `A required column is missing: ${parsed.missing.map(colName).join(", ")}.`)}
      </p>
    );
  }
  if (!parsed.rows.length) {
    return (
      <p role="alert" className={box}>
        <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        {tr("لا صفوف تحت أسماء الأعمدة.", "There are no rows under the column names.")}
      </p>
    );
  }
  if (parsed.rows.length > IMPORT_LIMIT) {
    return (
      <p role="alert" className={box}>
        <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        {tr(`في الملف ${num(parsed.rows.length)} صف، والحد ${num(IMPORT_LIMIT)}: قسّمه إلى ملفات أصغر.`, `The file has ${parsed.rows.length} rows; the limit is ${IMPORT_LIMIT}: split it into smaller files.`)}
      </p>
    );
  }
  return null;
}

function PreviewTable({ rows, checks, colName, teams }: { rows: ImportRow[]; checks: ImportCheck[]; colName: (k: keyof ImportRow) => string; teams: Team[] }) {
  const { tr, num, lang } = useFmt();
  const th = "px-3 py-2 text-start text-xs font-medium whitespace-nowrap text-muted";
  const cols: (keyof ImportRow)[] = ["name", "name_en", "email", "phone", "role", "title", "team"];
  const shown = (key: keyof ImportRow, row: ImportRow) => {
    if (key === "role") {
      const r = roleFromText(row.role);
      return r ? tr(ROLES[r].ar, ROLES[r].en) : row.role;
    }
    if (key === "team" && row.team) {
      const t = teams.find((x) => x.name.toLowerCase() === row.team.trim().toLowerCase() || x.name_en?.toLowerCase() === row.team.trim().toLowerCase());
      return t ? (lang === "en" && t.name_en ? t.name_en : t.name) : row.team;
    }
    return row[key];
  };
  const problemText = (p: ImportCheck["problems"][number]) => {
    const w = PROBLEM_WORDS[p.problem];
    return p.other_line ? tr(`${w.ar} (السطر ${num(p.other_line)})`, `${w.en} (line ${p.other_line})`) : tr(w.ar, w.en);
  };
  if (!checks.length) return <p className="px-4 py-6 text-sm text-muted">{tr("لا صفوف هنا.", "No rows here.")}</p>;
  return (
    <>
    {/* A phone: one card per row, its problems under it (a wide table would hide them off the screen). */}
    <ul aria-label={tr("الصفوف", "Rows")} className="divide-y divide-line md:hidden">
      {checks.map((c) => {
        const row = rows[c.line - 1];
        return (
          <li key={c.line} className={cn("flex flex-col gap-1 px-4 py-3 text-sm", c.problems.length && "bg-danger-soft/40")}>
            <span className="flex items-center gap-2">
              <span className="num text-xs text-muted">{num(c.line)}</span>
              <span className="font-medium">{row.name || "—"}</span>
              {c.problems.length ? (
                <span className="ms-auto flex items-center gap-1 text-xs font-medium text-danger">
                  <CircleAlert size={14} aria-hidden="true" />
                  {tr("سيُترك", "Skipped")}
                </span>
              ) : (
                <span className="ms-auto flex items-center gap-1 text-xs font-medium text-success">
                  <CircleCheck size={14} aria-hidden="true" />
                  {tr("جاهز", "Ready")}
                </span>
              )}
            </span>
            <span dir="ltr" className="truncate text-start text-xs text-muted">
              {row.email || "—"}
            </span>
            <span className="text-xs text-muted">{[shown("role", row), row.title, shown("team", row)].filter(Boolean).join(" · ")}</span>
            {c.problems.map((p) => (
              <span key={p.field + p.problem} className="text-xs text-danger">
                {colName(p.field)}: {problemText(p)}
              </span>
            ))}
          </li>
        );
      })}
    </ul>
    <div className="overflow-x-auto max-md:hidden">
      <table className="w-full min-w-[56rem] text-sm">
        <caption className="sr-only">{tr("الصفوف وفحص كل صف", "The rows and the check of each")}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={th}>
              #
            </th>
            <th scope="col" className={th}>
              {tr("الحالة", "Status")}
            </th>
            {cols.map((k) => (
              <th key={k} scope="col" className={th}>
                {colName(k)}
              </th>
            ))}
            <th scope="col" className={th}>
              {tr("المشكلة", "Problem")}
            </th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => {
            const row = rows[c.line - 1];
            const bad = new Set(c.problems.map((p) => p.field));
            return (
              <tr key={c.line} className={cn("border-b border-line last:border-0", c.problems.length && "bg-danger-soft/40")}>
                <td className="num px-3 py-2 text-xs text-muted">{num(c.line)}</td>
                <td className="px-3 py-2">
                  {c.problems.length ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-danger">
                      <CircleAlert size={14} aria-hidden="true" />
                      {tr("سيُترك", "Skipped")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <CircleCheck size={14} aria-hidden="true" />
                      {tr("جاهز", "Ready")}
                    </span>
                  )}
                </td>
                {cols.map((k) => (
                  <td key={k} className={cn("max-w-48 truncate px-3 py-2", bad.has(k) && "font-medium text-danger underline decoration-wavy decoration-1 underline-offset-4")} dir={k === "email" || k === "phone" || k === "name_en" ? "ltr" : "auto"}>
                    {shown(k, row) || <span className="text-faint">—</span>}
                  </td>
                ))}
                <td className="min-w-56 px-3 py-2 text-xs text-danger">
                  {c.problems.map((p) => (
                    <span key={p.field + p.problem} className="block">
                      {problemText(p)}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

function ResultPanel({ result, rows, onRestart }: { result: ImportResult; rows: ImportRow[]; onRestart: () => void }) {
  const { tr, num } = useFmt();
  const created = result.rows.filter((r) => r.user_id !== undefined);
  const skipped = result.rows.filter((r) => r.user_id === undefined);
  return (
    <Panel
      title={tr(`الحسابات المُنشأة: ${num(result.created)} · المتروكة: ${num(result.skipped)}`, `${result.created} created, ${result.skipped} skipped`)}
      note={tr("أصحاب الحسابات الجديدة يدخلون ببريدهم. سُجّل الاستيراد في سجل العمليات.", "The new accounts' owners sign in with their email. The import is in the audit log.")}
      tools={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onRestart}>
            <RotateCcw size={14} aria-hidden="true" />
            {tr("استيراد ملف آخر", "Import another file")}
          </Button>
          <ButtonLink href="/admin?tab=users" size="sm">
            {tr("افتح قائمة المستخدمين", "Open the users")}
          </ButtonLink>
        </div>
      }
    >
      <div className="grid divide-line lg:grid-cols-2 lg:divide-x rtl:lg:divide-x-reverse max-lg:divide-y">
        <section aria-label={tr("ما أُنشئ", "Created")} className="flex flex-col">
          <h3 className="flex items-center gap-2 px-4 pt-3 pb-1 text-sm font-semibold text-success">
            <CircleCheck size={16} aria-hidden="true" />
            {tr(`أُنشئ (${num(created.length)})`, `Created (${created.length})`)}
          </h3>
          <ul className="divide-y divide-line">
            {created.map((c) => (
              <li key={c.line} className="flex flex-col px-4 py-2 text-sm">
                <span className="font-medium">{rows[c.line - 1]?.name}</span>
                <span dir="ltr" className="text-start text-xs text-muted">
                  {rows[c.line - 1]?.email.toLowerCase()}
                </span>
              </li>
            ))}
            {!created.length && <li className="px-4 py-3 text-sm text-muted">{tr("لم يُنشأ شيء.", "Nothing was created.")}</li>}
          </ul>
        </section>
        <section aria-label={tr("ما تُرك", "Skipped")} className="flex flex-col">
          <h3 className="flex items-center gap-2 px-4 pt-3 pb-1 text-sm font-semibold text-danger">
            <CircleAlert size={16} aria-hidden="true" />
            {tr(`تُرك (${num(skipped.length)})`, `Skipped (${skipped.length})`)}
          </h3>
          <ul className="divide-y divide-line">
            {skipped.map((c) => (
              <li key={c.line} className="flex flex-col px-4 py-2 text-sm">
                <span className="font-medium">
                  {tr(`السطر ${num(c.line)}`, `Line ${c.line}`)}: <bdi>{rows[c.line - 1]?.name || rows[c.line - 1]?.email || "—"}</bdi>
                </span>
                <span className="text-xs text-danger">
                  {c.problems.map((p) => tr(PROBLEM_WORDS[p.problem].ar, PROBLEM_WORDS[p.problem].en)).join("؛ ")}
                </span>
              </li>
            ))}
            {!skipped.length && <li className="px-4 py-3 text-sm text-muted">{tr("لم يُترك شيء.", "Nothing was skipped.")}</li>}
          </ul>
        </section>
      </div>
    </Panel>
  );
}
