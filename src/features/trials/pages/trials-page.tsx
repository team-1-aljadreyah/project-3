import { arN, W } from "@/shared/lib/count-words";
import { ChevronLeft, FlaskConical, Lock, Pencil, Plus, RotateCcw, Send, Square, UserPlus } from "lucide-react";
import { useRef, useState } from "react";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { useQueryParam } from "@/shared/lib/query-param";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn, daysBetween, today } from "@/shared/lib/utils";
import { Avatar, Button, Empty, ErrorBox, LoadingBlock, Pill, PrintButton, Skeleton, Stat, useToast, errorText } from "@/shared/ui";
import { trialsApi } from "../api";
import { MemberSheet } from "../components/member-sheet";
import { SendToCeoDialog } from "../components/send-dialog";
import { Stars } from "../components/stars";
import { TrialMemberDialog, TrialTeamDialog } from "../components/trial-dialogs";
import { canUseTrials, DECISION_WORDS, scoreText } from "../rules";
import type { TrialMember, TrialTeam, TrialTeamDetail, TrialTeamRow } from "../types";

/** The line that says whose this page is (on the list and on each team). */
function PrivateNote() {
  const { tr } = useFmt();
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted print:hidden">
      <Lock size={14} aria-hidden="true" className="shrink-0 text-accent" />
      {tr("خاص بك: لا يراه أحد غيرك، ولا المدير التنفيذي، إلا ما ترسله إليه.", "Yours only: nobody else sees it, not even the CEO, except what you send.")}
    </p>
  );
}

/**
 * /trials: the monitoring officer's trial teams (the client, 24 November 2026): new teams under test, made by her with
 * their new people; she rates each person and writes notes, decides who stays, prints a PDF or sends a report to the
 * CEO. Hers only. One team opens in place (/trials?team=3), so a link can open it.
 */
export function TrialsPage() {
  const { tr } = useFmt();
  usePageTitle(tr("الفرق التجريبية", "Trial teams"));
  const me = useUser();
  const [team, setTeam] = useQueryParam<string>("team", "");
  if (!canUseTrials(me)) return <Empty title={tr("هذه الصفحة لمسؤول المتابعة والتقييم", "This page is for the monitoring officer")} />;
  return team ? <TeamView id={Number(team)} onBack={() => setTeam("")} /> : <TeamList onOpen={(id) => setTeam(String(id))} />;
}

function TeamList({ onOpen }: { onOpen: (id: number) => void }) {
  const { tr, num, day } = useFmt();
  const load = useLoad(() => trialsApi.teams());
  const [making, setMaking] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tr("الفرق التجريبية", "Trial teams")}</h1>
          <PrivateNote />
        </div>
        <Button pill onClick={() => setMaking(true)}>
          <Plus size={16} aria-hidden="true" />
          {tr("فريق تجريبي جديد", "New trial team")}
        </Button>
      </div>

      {load.state.status === "loading" && !load.data ? (
        <LoadingBlock className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </LoadingBlock>
      ) : load.state.status === "error" ? (
        <ErrorBox error={load.state.error} onRetry={load.reload} />
      ) : !load.data?.length ? (
        <Empty
          title={tr("لا فرق تجريبية بعد", "No trial teams yet")}
          body={tr("أنشئ فريقاً تجريبياً، وأضف أعضاءه الجدد، ثم قيّم كل واحد منهم واكتب ملاحظاتك.", "Make a trial team, add its new people, then rate each one and write your notes.")}
        />
      ) : (
        <ul aria-label={tr("الفرق التجريبية", "Trial teams")} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {load.data.map((t) => (
            <li key={t.id}>
              <TeamCard row={t} onOpen={() => onOpen(t.id)} num={num} day={day} />
            </li>
          ))}
        </ul>
      )}
      {making && <TrialTeamDialog onClose={() => setMaking(false)} onSaved={(t) => onOpen(t.id)} />}
    </div>
  );
}

function TeamCard({ row, onOpen, num, day }: { row: TrialTeamRow; onOpen: () => void; num: (n: number) => string; day: (d: string) => string }) {
  const { tr } = useFmt();
  const running = row.status === "running";
  const days = daysBetween(row.started_on, row.ended_on ?? today());
  return (
    // The whole card opens the team (click anywhere).
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex h-full w-full flex-col gap-3 rounded-2xl border border-line bg-card p-4 text-start transition-colors hover:border-accent",
        !running && "bg-card-2",
      )}
    >
      <span className="flex items-start gap-3">
        <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", running ? "bg-accent text-on-accent" : "bg-chip text-muted")}>
          <FlaskConical size={19} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span dir="auto" className="truncate font-semibold">
            {row.name}
          </span>
          <span className="text-xs text-muted">
            {running ? tr(`منذ ${day(row.started_on)} · اليوم ${num(days + 1)}`, `Since ${day(row.started_on)} · day ${days + 1}`) : tr(`انتهت ${day(row.ended_on ?? row.started_on)}`, `Ended ${day(row.ended_on ?? row.started_on)}`)}
          </span>
        </span>
        <Pill tone={running ? "progress" : "new"}>{running ? tr("جارية", "Running") : tr("منتهية", "Ended")}</Pill>
      </span>
      {row.goal && (
        <span dir="auto" className="line-clamp-2 text-sm text-muted">
          {row.goal}
        </span>
      )}
      <span className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
        <span>{tr(`${arN(row.members, W.member)}`, `${row.members} people`)}</span>
        <span className="inline-flex items-center gap-1.5">
          <Stars value={row.average} size={13} />
          {row.average !== undefined && <span className="font-medium text-text">{scoreText(row.average)}</span>}
        </span>
        {row.accepted > 0 && <span>{tr(`مقبولون ${num(row.accepted)}`, `${row.accepted} kept`)}</span>}
        <ChevronLeft size={15} aria-hidden="true" className="ms-auto text-faint transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function TeamView({ id, onBack }: { id: number; onBack: () => void }) {
  const { tr, num, day, ago } = useFmt();
  const toast = useToast();
  const load = useLoad(() => trialsApi.team(id), [id]);
  const paper = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [editMember, setEditMember] = useState<TrialMember | null>(null);
  const [sending, setSending] = useState(false);
  usePageTitle(load.data?.team.name ?? tr("الفرق التجريبية", "Trial teams"));

  if (load.state.status === "loading" && !load.data) {
    return (
      <LoadingBlock className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </LoadingBlock>
    );
  }
  if (load.state.status === "error") return <ErrorBox error={load.state.error} onRetry={load.reload} />;
  if (!load.data) return null;
  const detail: TrialTeamDetail = load.data;
  const { team, members, entries } = detail;
  const running = team.status === "running";
  const scores = entries.flatMap((e) => (e.score ? [e.score] : []));
  const average = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : undefined;
  const kept = members.filter((m) => m.decision === "accepted").length;
  const openMember = members.find((m) => m.id === open);
  const lastNote = (memberId: number) => entries.find((e) => e.member_id === memberId && e.text);

  const setStatus = async (status: TrialTeam["status"]) => {
    try {
      await trialsApi.updateTeam(team.id, { status });
      toast(status === "ended" ? tr("انتهت التجربة. يبقى الفريق وسجله كما هما.", "The trial has ended. The team and its history stay.") : tr("استُؤنفت التجربة.", "The trial is running again."));
      load.reload();
    } catch (e) {
      toast(errorText(e, tr));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <nav aria-label={tr("مسار الصفحة", "Breadcrumb")} className="text-[13px] text-muted print:hidden">
        <button type="button" onClick={onBack} className="hover:text-text hover:underline">
          {tr("الفرق التجريبية", "Trial teams")}
        </button>
      </nav>

      {/* Everything from here to the table is what the PDF holds. */}
      <div ref={paper} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 dir="auto" className="flex flex-wrap items-center gap-2.5 text-2xl font-semibold">
              {team.name}
              <Pill tone={running ? "progress" : "new"}>{running ? tr("جارية", "Running") : tr("منتهية", "Ended")}</Pill>
            </h1>
            <p className="text-sm text-muted">
              {running
                ? tr(`بدأت ${day(team.started_on)} · اليوم ${num(daysBetween(team.started_on, today()) + 1)} من التجربة`, `Started ${day(team.started_on)} · day ${daysBetween(team.started_on, today()) + 1} of the trial`)
                : tr(`من ${day(team.started_on)} إلى ${day(team.ended_on ?? team.started_on)}`, `From ${day(team.started_on)} to ${day(team.ended_on ?? team.started_on)}`)}
            </p>
            {team.goal && (
              <p dir="auto" className="max-w-3xl text-sm leading-relaxed whitespace-pre-line">
                {team.goal}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button pill onClick={() => setAdding(true)}>
              <UserPlus size={16} aria-hidden="true" />
              {tr("عضو جديد", "New member")}
            </Button>
            <Button pill variant="secondary" onClick={() => setSending(true)}>
              <Send size={15} aria-hidden="true" />
              {tr("أرسل إلى المدير التنفيذي", "Send to the CEO")}
            </Button>
            <PrintButton target={() => paper.current} label={tr("PDF أو طباعة", "PDF or print")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={tr("الأعضاء", "People")} value={num(members.length)} note={tr(`قيد التقييم ${num(members.filter((m) => m.decision === "pending").length)}`, `${members.filter((m) => m.decision === "pending").length} being assessed`)} />
          <Stat label={tr("متوسط الفريق", "Team average")} value={average !== undefined ? scoreText(average) : "—"} note={<Stars value={average} size={13} />} />
          <Stat label={tr("مقبولون", "Kept")} value={num(kept)} note={tr(`غير مقبولين ${num(members.filter((m) => m.decision === "rejected").length)}`, `${members.filter((m) => m.decision === "rejected").length} not kept`)} />
          <Stat label={tr("تقييمات وملاحظات", "Ratings and notes")} value={num(entries.length)} note={entries[0] ? tr(`آخرها ${ago(entries[0].at)}`, `Latest ${ago(entries[0].at)}`) : tr("لا شيء بعد", "None yet")} />
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong/60 bg-card px-6 py-10 text-center print:hidden">
            <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
              <UserPlus size={22} />
            </span>
            <p className="font-medium">{tr("أضف أعضاء الفريق الجدد", "Add the team's new people")}</p>
            <p className="max-w-md text-sm text-muted">{tr("ليسوا حسابات في المنصة: اسم وتخصص يكفيان. بعدها قيّم كل واحد واكتب ملاحظاتك.", "They are not accounts on the platform: a name and what they do are enough. Then rate each one and write your notes.")}</p>
            <Button pill onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden="true" />
              {tr("عضو جديد", "New member")}
            </Button>
          </div>
        ) : (
          <ul aria-label={tr("أعضاء الفريق", "The team's people")} className="flex flex-col overflow-hidden rounded-xl border border-line bg-card">
            <li aria-hidden="true" className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,2fr)_7rem] gap-4 border-b border-line px-4 py-2.5 text-xs text-muted md:grid">
              <span>{tr("العضو", "Person")}</span>
              <span>{tr("التقييم", "Rating")}</span>
              <span>{tr("آخر ملاحظة", "Latest note")}</span>
              <span>{tr("القرار", "Decision")}</span>
            </li>
            {members.map((m) => {
              const note = lastNote(m.id);
              return (
                <li key={m.id} className="border-b border-line last:border-0">
                  {/* The whole row opens the person (click anywhere). */}
                  <button
                    type="button"
                    onClick={() => setOpen(m.id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 text-start hover:bg-card-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,2fr)_7rem]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar user={{ id: 1000 + m.id, name: m.name }} size="lg" />
                      <span className="flex min-w-0 flex-col">
                        <span dir="auto" className="truncate font-medium">
                          {m.name}
                        </span>
                        <span className="truncate text-xs text-muted">{m.specialty}</span>
                      </span>
                    </span>
                    <span className="order-last col-span-2 flex items-center gap-2 text-sm md:order-none md:col-span-1">
                      <Stars value={m.average} size={14} />
                      <span className="text-xs text-muted">{m.average !== undefined ? tr(`${scoreText(m.average)} · ${arN(m.scores, W.rating)}`, `${scoreText(m.average)} · ${m.scores} ratings`) : tr("لم يُقيَّم", "Not rated")}</span>
                    </span>
                    <span dir="auto" className="col-span-2 line-clamp-2 text-sm text-muted md:col-span-1">
                      {note?.text ? `«${note.text}»` : <span className="text-faint">{tr("لا ملاحظات بعد", "No notes yet")}</span>}
                    </span>
                    <span className="row-start-1 justify-self-end md:row-start-auto md:justify-self-start">
                      <Pill tone={DECISION_WORDS[m.decision].tone}>{tr(DECISION_WORDS[m.decision].ar, DECISION_WORDS[m.decision].en)}</Pill>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 print:hidden">
        <PrivateNote />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil size={14} aria-hidden="true" />
            {tr("عدّل الفريق", "Edit the team")}
          </Button>
          {running ? (
            <Button size="sm" variant="secondary" onClick={() => void setStatus("ended")}>
              <Square size={13} aria-hidden="true" />
              {tr("أنهِ التجربة", "End the trial")}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void setStatus("running")}>
              <RotateCcw size={14} aria-hidden="true" />
              {tr("استأنف التجربة", "Run the trial again")}
            </Button>
          )}
        </div>
      </div>

      {editing && <TrialTeamDialog team={team} onClose={() => setEditing(false)} onSaved={() => load.reload()} />}
      {adding && <TrialMemberDialog teamId={team.id} onClose={() => setAdding(false)} onSaved={() => load.reload()} />}
      {editMember && <TrialMemberDialog teamId={team.id} member={editMember} onClose={() => setEditMember(null)} onSaved={() => load.reload()} />}
      {openMember && !editMember && (
        <MemberSheet
          member={openMember}
          entries={entries}
          ended={!running}
          onClose={() => setOpen(null)}
          onChanged={() => load.reload()}
          onEdit={() => setEditMember(openMember)}
        />
      )}
      {sending && <SendToCeoDialog detail={detail} onClose={() => setSending(false)} />}
    </div>
  );
}
