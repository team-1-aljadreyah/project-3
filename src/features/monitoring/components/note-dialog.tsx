import { useState } from "react";
import { ApiError } from "@/shared/api";
import type { Team, User } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Button, Dialog, Field, Input, PeoplePicker, Select, Textarea, errorText, useToast } from "@/shared/ui";
import { monitoringApi } from "../api";
import { NOTE_LIMITS as L } from "../rules";
import type { MonitorNote, NoteInput, NoteKind } from "../types";

export const KIND: Record<NoteKind, { ar: string; en: string; hint_ar: string; hint_en: string }> = {
  report: { ar: "تقرير", en: "Report", hint_ar: "عن فريق أو شخص أو مشروع", hint_en: "About a team, a person or a project" },
  feedback: { ar: "ملاحظة على شخص", en: "Feedback", hint_ar: "ثناء أو شيء يتحسن", hint_en: "Praise, or something to improve" },
  problem: { ar: "مشكلة", en: "Problem", hint_ar: "شيء يحتاج قراراً", hint_en: "Something that needs a decision" },
  request: { ar: "طلب", en: "Request", hint_ar: "طلب إلى المدير التنفيذي", hint_en: "A request to the CEO" },
};
/** The kinds the monitoring officer writes (requests come from employees, on their own page). */
const NOTE_KINDS: NoteKind[] = ["report", "feedback", "problem"];

/**
 * Write a report (about a team, a person, a project or in general), feedback on anyone, or a problem. It can go to
 * the CEO at once ("Send to the CEO now"), or be kept and sent later from the list.
 */
export function NoteDialog({
  open,
  onClose,
  onSaved,
  people,
  teams,
  projects,
  me,
  start = "report",
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (note: MonitorNote) => void;
  people: User[];
  teams: Team[];
  projects: { id: number; name: string; name_en?: string }[];
  me: number;
  start?: NoteKind;
}) {
  const { tr, lang } = useFmt();
  const toast = useToast();
  const [kind, setKind] = useState<NoteKind>(start);
  const [about, setAbout] = useState("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<"praise" | "improve">("praise");
  const [subject, setSubject] = useState("");
  const [involved, setInvolved] = useState<number[]>([]);
  const [send, setSend] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Each time the window opens, it starts empty.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setKind(start);
      setAbout(start === "feedback" ? "" : "general");
      setTitle("");
      setBody("");
      setTone("praise");
      setSubject("");
      setInvolved([]);
      setSend(true);
      setErrors({});
      setFormError(undefined);
    }
  }

  const name = (x: { name: string; name_en?: string }) => (lang === "en" && x.name_en ? x.name_en : x.name);
  const others = people.filter((p) => p.active && p.id !== me);

  const save = async () => {
    const problems: Record<string, string> = {};
    if (!about) problems.about = tr("اختر الشخص.", "Choose the person.");
    if (!title.trim()) problems.title = tr("اكتب عنواناً.", "Enter a title.");
    if (!body.trim()) problems.body = tr("اكتب النص.", "Enter the text.");
    if (Object.keys(problems).length) return setErrors(problems);
    const [type, id] = about.split(":");
    const input: NoteInput = {
      kind,
      title,
      body,
      about: { type: type as NoteInput["about"]["type"], id: id ? Number(id) : undefined },
      send,
      ...(kind === "feedback" ? { tone } : {}),
      // A problem can be about anything (in her words) and involve anyone.
      ...(kind === "problem" ? { subject, people_ids: involved } : {}),
    };
    setBusy(true);
    setErrors({});
    setFormError(undefined);
    try {
      const note = await monitoringApi.create(input);
      toast(send ? tr("حُفظت وأُرسلت إلى المدير التنفيذي.", "Saved and sent to the CEO.") : tr("حُفظت. أرسلها متى شئت.", "Saved. Send it whenever you like."));
      onSaved(note);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      else setFormError(errorText(e, tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tr("كتابة جديدة", "Write something")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? tr("جارٍ الحفظ…", "Saving…") : send ? tr("احفظ وأرسل", "Save and send") : tr("احفظ", "Save")}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{tr("النوع", "Kind")}</legend>
          <div className="grid grid-cols-3 gap-2">
            {NOTE_KINDS.map((k) => (
              <label key={k} className={cn("flex cursor-pointer flex-col gap-0.5 rounded-xl border p-2.5 text-sm", kind === k ? "border-accent bg-accent-soft" : "border-line")}>
                <input
                  type="radio"
                  name="note-kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => {
                    setKind(k);
                    if (k === "feedback" && !about.startsWith("person:")) setAbout("");
                  }}
                  className="sr-only"
                />
                <b className="font-medium">{tr(KIND[k].ar, KIND[k].en)}</b>
                <span className="text-xs text-muted">{tr(KIND[k].hint_ar, KIND[k].hint_en)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind === "problem" && (
          <Field label={tr("عن ماذا", "What it is about")} hint={tr("اكتب أي موضوع، بكلماتك.", "Any subject, in your own words.")} htmlFor="note-subject" error={errors.subject}>
            <Input id="note-subject" dir="auto" maxLength={L.subject} value={subject} invalid={!!errors.subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
        )}
        <Field
          label={kind === "feedback" ? tr("على من", "About whom") : kind === "problem" ? tr("يخصّ فريقاً أو مشروعاً (اختياري)", "A team or project (optional)") : tr("يخصّ", "About")}
          htmlFor="note-about"
          error={errors.about}
        >
          <Select id="note-about" value={about} invalid={!!errors.about} onChange={(e) => setAbout(e.target.value)}>
            {kind === "feedback" ? (
              <option value="">{tr("اختر شخصاً…", "Choose a person…")}</option>
            ) : (
              <option value="general">{tr("عام", "General")}</option>
            )}
            {kind !== "feedback" && teams.length > 0 && (
              <optgroup label={tr("الفرق", "Teams")}>
                {teams.map((t) => (
                  <option key={t.id} value={`team:${t.id}`}>
                    {name(t)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={tr("الأشخاص", "People")}>
              {others.map((p) => (
                <option key={p.id} value={`person:${p.id}`}>
                  {name(p)}
                </option>
              ))}
            </optgroup>
            {kind !== "feedback" && projects.length > 0 && (
              <optgroup label={tr("المشاريع", "Projects")}>
                {projects.map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>
                    {name(p)}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>

        {kind === "problem" && (
          <PeoplePicker people={others} value={involved} onChange={setInvolved} error={errors.people_ids} legend={{ ar: "الأشخاص المعنيون", en: "People involved" }} />
        )}

        {kind === "feedback" && (
          <fieldset className="flex gap-2">
            <legend className="sr-only">{tr("نوع الملاحظة", "Kind of feedback")}</legend>
            {(["praise", "improve"] as const).map((t) => (
              <label key={t} className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-sm", tone === t ? "border-accent bg-accent-soft font-medium" : "border-line")}>
                <input type="radio" name="note-tone" value={t} checked={tone === t} onChange={() => setTone(t)} className="sr-only" />
                {t === "praise" ? tr("ثناء", "Praise") : tr("شيء يتحسن", "To improve")}
              </label>
            ))}
          </fieldset>
        )}

        <Field label={tr("العنوان", "Title")} htmlFor="note-title" error={errors.title}>
          <Input id="note-title" maxLength={L.title} value={title} invalid={!!errors.title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={tr("النص", "Text")} htmlFor="note-body" error={errors.body}>
          <Textarea id="note-body" dir="auto" maxLength={L.body} rows={6} value={body} invalid={!!errors.body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          {tr("أرسلها إلى المدير التنفيذي الآن", "Send it to the CEO now")}
        </label>
        {formError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
      </form>
    </Dialog>
  );
}
