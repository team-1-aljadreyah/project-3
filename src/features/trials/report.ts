// The report of a trial team that the monitoring officer sends to the CEO: plain text for her inbox (a monitoring report
// note), in one language, from what the screen already has. Pure: no React, tested in tests/unit/trials.test.ts.
import { arN, W } from "@/shared/lib/count-words";
import { DECISION_WORDS, NOTE_BODY_MAX, scoreText } from "./rules";
import type { TrialEntry, TrialTeamDetail } from "./types";

type Tr = (ar: string, en: string) => string;

/** The latest note about each member (the CEO reads the newest words), cut to a short line. */
const lastNote = (entries: TrialEntry[], memberId: number) => entries.find((e) => e.member_id === memberId && e.text)?.text;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The report's title and text. `day` writes a date in the reader's language; `extra` is her own words, at the top. */
export function trialReport(detail: TrialTeamDetail, { tr, day, extra }: { tr: Tr; day: (d: string) => string; extra?: string }) {
  const { team, members, entries } = detail;
  const title = tr(`تقرير الفريق التجريبي: ${team.name}`, `Trial team report: ${team.name}`);
  const lines: string[] = [];
  if (extra?.trim()) lines.push(extra.trim(), "");
  if (team.goal) lines.push(tr(`الهدف: ${team.goal}`, `Goal: ${team.goal}`));
  lines.push(
    team.status === "ended" && team.ended_on
      ? tr(`المدة: من ${day(team.started_on)} إلى ${day(team.ended_on)}`, `From ${day(team.started_on)} to ${day(team.ended_on)}`)
      : tr(`بدأت التجربة: ${day(team.started_on)} (ما زالت جارية)`, `Started on ${day(team.started_on)} (still running)`),
  );
  const kept = members.filter((m) => m.decision === "accepted").length;
  const out = members.filter((m) => m.decision === "rejected").length;
  lines.push(tr(`الأعضاء: ${members.length} · مقبولون ${kept} · غير مقبولين ${out} · قيد التقييم ${members.length - kept - out}`, `People: ${members.length} · kept ${kept} · not kept ${out} · being assessed ${members.length - kept - out}`), "");

  members
    .slice()
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
    .forEach((m, i) => {
      const score = m.average !== undefined ? tr(`${scoreText(m.average)} من 5 (${arN(m.scores, W.rating)})`, `${scoreText(m.average)} of 5 (${m.scores} ratings)`) : tr("بلا تقييم بعد", "not rated yet");
      const decision = tr(DECISION_WORDS[m.decision].ar, DECISION_WORDS[m.decision].en);
      lines.push(`${i + 1}. ${m.name}، ${m.specialty}: ${score} · ${decision}`);
      const note = lastNote(entries, m.id);
      if (note) lines.push(`   ${tr("آخر ملاحظة", "Latest note")}: «${cut(note.replace(/\s+/g, " "), 220)}»`);
    });
  if (!members.length) lines.push(tr("لا أعضاء بعد.", "No people yet."));

  return { title: cut(title, 160), body: cut(lines.join("\n"), NOTE_BODY_MAX) };
}
