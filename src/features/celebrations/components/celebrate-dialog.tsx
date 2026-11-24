import { Eye, PartyPopper, Sparkles, Trophy } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/shared/api";
import { useFmt } from "@/shared/lib/i18n";
import { useUser } from "@/shared/lib/session";
import { roleName } from "@/shared/lib/site";
import { cn } from "@/shared/lib/utils";
import { Button, Dialog, errorText, Field, Select, Textarea, useToast } from "@/shared/ui";
import { celebrationsApi } from "../api";
import { canCelebrateTeams, CELEBRATION_KINDS, CELEBRATION_LIMITS, KIND_WORDS } from "../rules";
import type { CelebrationKind } from "../types";
import { CelebrationOverlay, type Moment } from "./celebration-overlay";

export interface TeamChoice {
  id: number;
  name: string;
  name_en?: string;
}

const KIND_ICON = { good: Sparkles, big: Trophy } as const;

/**
 * "Celebrate a team": the team (fixed on a team's page), the kind (good work or a big achievement), a few words, a
 * preview of what the team will see, and Send. Every active member sees it once, the next time they open the platform.
 */
export function CelebrateDialog({ teams, teamId, onClose }: { teams: TeamChoice[]; teamId?: number; onClose: () => void }) {
  const { tr, lang, num } = useFmt();
  const me = useUser();
  const toast = useToast();
  const [team, setTeam] = useState(teamId ? String(teamId) : "");
  const [kind, setKind] = useState<CelebrationKind>("good");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Moment | null>(null);
  const nameOf = (t?: TeamChoice) => (t ? (lang === "en" && t.name_en ? t.name_en : t.name) : "");
  const chosen = teams.find((t) => String(t.id) === team);

  const moment = (): Moment => ({
    key: "preview",
    effect: kind,
    eyebrow: tr(`احتفال مع ${nameOf(chosen) || "…"}`, `Celebrating with ${nameOf(chosen) || "…"}`),
    title: tr(KIND_WORDS[kind].title_ar, KIND_WORDS[kind].title_en),
    quote: message.trim() || undefined,
    body: message.trim() ? undefined : tr("شكراً على عملكم. يستحق هذا أن نحتفل به معاً.", "Thank you for your work. This deserves a celebration together."),
    from: { name: lang === "en" && me.name_en ? me.name_en : me.name, role: roleName(me, lang) },
    close: tr("أغلق المعاينة", "Close the preview"),
  });

  const send = async () => {
    if (!team) return setErrors({ team_id: tr("اختر فريقاً.", "Choose a team.") });
    setBusy(true);
    setErrors({});
    try {
      const sent = await celebrationsApi.celebrate({ team_id: Number(team), kind, message: message.trim() || undefined });
      toast(tr(`أُرسل الاحتفال إلى «${nameOf(chosen)}» (${num(sent.sent_to)} أشخاص). يرونه عند فتح المنصة.`, `Sent to ${nameOf(chosen)} (${sent.sent_to} people). They see it when they open the platform.`));
      onClose();
    } catch (e) {
      setErrors(e instanceof ApiError && e.errors ? e.errors : { form: errorText(e, tr) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog
        open={!preview}
        onClose={onClose}
        title={teamId ? tr(`احتفل مع ${nameOf(chosen)}`, `Celebrate with ${nameOf(chosen)}`) : tr("احتفل بفريق", "Celebrate a team")}
        className="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreview(moment())}>
              <Eye size={16} aria-hidden="true" />
              {tr("معاينة", "Preview")}
            </Button>
            <Button onClick={send} disabled={busy}>
              <PartyPopper size={16} aria-hidden="true" />
              {busy ? tr("جارٍ الإرسال…", "Sending…") : tr("احتفل", "Celebrate")}
            </Button>
          </>
        }
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {!teamId && (
            <Field label={tr("الفريق", "Team")} htmlFor="cel-team" error={errors.team_id}>
              <Select id="cel-team" value={team} invalid={!!errors.team_id} onChange={(e) => setTeam(e.target.value)}>
                <option value="">{tr("اختر الفريق", "Choose the team")}</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {nameOf(t)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {teamId && errors.team_id && (
            <p role="alert" className="text-sm text-danger">
              {errors.team_id}
            </p>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{tr("نوع الاحتفال", "Kind of celebration")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CELEBRATION_KINDS.map((k) => {
                const Icon = KIND_ICON[k];
                const on = kind === k;
                return (
                  // The whole card is the choice (click anywhere).
                  <label
                    key={k}
                    className={cn(
                      "relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent",
                      on ? "border-accent bg-accent-soft/60" : "border-line bg-card-2 hover:border-line-strong",
                    )}
                  >
                    <input type="radio" name="cel-kind" value={k} checked={on} onChange={() => setKind(k)} className="sr-only" />
                    <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", on ? "bg-accent text-on-accent" : "bg-chip text-accent-ink")}>
                      <Icon size={19} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium">{tr(KIND_WORDS[k].ar, KIND_WORDS[k].en)}</span>
                      <span className="text-xs leading-relaxed text-muted">{tr(KIND_WORDS[k].hint_ar, KIND_WORDS[k].hint_en)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <Field
            label={tr("كلمة للفريق (اختياري)", "A few words for the team (optional)")}
            htmlFor="cel-message"
            error={errors.message}
            hint={`${num(message.length)} / ${num(CELEBRATION_LIMITS.message)}`}
          >
            <Textarea
              id="cel-message"
              rows={3}
              maxLength={CELEBRATION_LIMITS.message}
              value={message}
              invalid={!!errors.message}
              placeholder={tr("مثلاً: أطلقتم النسخة الأولى قبل موعدها. فخورون بكم!", "For example: you launched the first version early. Proud of you!")}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
          {errors.form && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {errors.form}
            </p>
          )}
        </form>
      </Dialog>
      {preview && <CelebrationOverlay moment={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

/** "Celebrate" for the monitoring officer and the CEO (nothing for anyone else). `teamId` fixes the team (a team's page). */
export function CelebrateButton({ teams, teamId, className }: { teams: TeamChoice[]; teamId?: number; className?: string }) {
  const { tr } = useFmt();
  const me = useUser();
  const [open, setOpen] = useState(false);
  if (!canCelebrateTeams(me)) return null;
  return (
    <>
      <Button pill variant="secondary" className={className} onClick={() => setOpen(true)}>
        <PartyPopper size={16} aria-hidden="true" />
        {teamId ? tr("احتفل بالفريق", "Celebrate the team") : tr("احتفل بفريق", "Celebrate a team")}
      </Button>
      {open && <CelebrateDialog teams={teams} teamId={teamId} onClose={() => setOpen(false)} />}
    </>
  );
}
