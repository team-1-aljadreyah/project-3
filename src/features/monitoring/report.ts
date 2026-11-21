// The report builder's numbers and its first draft. Pure functions, tested in tests/unit/monitoring.test.ts. The demo
// backend uses countReport; the real server must count the same way (docs/backend.md, section 16).
import type { Bug } from "@/features/bugs";
import { doneAt, personPerf } from "@/features/performance";
import { plannedRatio, type Project } from "@/features/projects";
import type { Task } from "@/features/tasks";
import type { User } from "@/shared/api/types";
import type { Fmt } from "@/shared/lib/format";
import type { NoteAbout, ReportFacts, ReportPeriod, ReportRow } from "./types";

export interface ReportSource {
  /** What the report is about, with its name (a team, a person or a project). */
  about: NoteAbout;
  period: ReportPeriod;
  /** Today, so "late" stops at today for a period that is not over. */
  today: string;
  /** The active people. */
  users: User[];
  projects: Project[];
  tasks: Task[];
  bugs: Bug[];
  counted_at: string;
}

const inPeriod = (iso: string | undefined, p: ReportPeriod) => !!iso && iso.slice(0, 10) >= p.from && iso.slice(0, 10) <= p.to;

/**
 * A report's numbers. A team: its members' tasks in every project, one row per member. A person: their tasks, one row
 * per project. A project: its tasks, one row per person who has tasks in it.
 */
export function countReport({ about, period, today, users, projects, tasks, bugs, counted_at }: ReportSource): ReportFacts {
  const scope = about.type === "project" ? projects.filter((p) => p.id === about.id) : projects;
  const people =
    about.type === "team"
      ? users.filter((u) => u.team_id === about.id)
      : about.type === "person"
        ? users.filter((u) => u.id === about.id)
        : users.filter((u) => tasks.some((t) => t.project_id === about.id && t.assignee_id === u.id));
  const ids = new Set(people.map((u) => u.id));
  const count = (userId: number, inProjects: Project[]) => {
    const { assigned, done, late, blocked, completion } = personPerf(userId, undefined, tasks, inProjects, period, today);
    return { assigned, done, late, blocked, completion };
  };

  const rows: ReportRow[] =
    about.type === "person"
      ? scope
          .filter((p) => tasks.some((t) => t.project_id === p.id && t.assignee_id === about.id))
          .map((p) => ({ type: "project" as const, id: p.id, label: p.name, label_en: p.name_en, ...count(about.id!, [p]) }))
          .filter((r) => r.assigned > 0)
      : people.map((u) => ({ type: "person" as const, id: u.id, label: u.name, label_en: u.name_en, ...count(u.id, scope) }));

  const sum = (k: "assigned" | "done" | "late" | "blocked") => rows.reduce((s, r) => s + r[k], 0);
  const assigned = sum("assigned");
  const done = sum("done");

  // On time: the finished tasks with a due day, finished in the period, and how many by their due day.
  const projectOf = new Map(scope.map((p) => [p.id, p]));
  let withDue = 0;
  let onTime = 0;
  const involved = new Set<number>();
  for (const t of tasks) {
    const p = projectOf.get(t.project_id);
    if (!p || !t.assignee_id || !ids.has(t.assignee_id)) continue;
    involved.add(p.id);
    const finished = doneAt(p, t)?.slice(0, 10);
    if (t.due && finished && finished >= period.from && finished <= period.to) {
      withDue++;
      if (finished <= t.due) onTime++;
    }
  }
  const planProjects = scope.filter((p) => involved.has(p.id));
  const theBugs = bugs.filter((b) => projectOf.has(b.project_id) && (about.type === "project" || (!!b.assignee_id && ids.has(b.assignee_id))));

  return {
    about,
    period,
    assigned,
    done,
    left: assigned - done,
    late: sum("late"),
    blocked: sum("blocked"),
    completion: assigned ? done / assigned : 0,
    on_time: withDue ? onTime / withDue : null,
    planned: planProjects.length ? planProjects.reduce((s, p) => s + plannedRatio(p.start, p.end, period.to), 0) / planProjects.length : null,
    bugs_reported: theBugs.filter((b) => inPeriod(b.created_at, period)).length,
    bugs_closed: theBugs.filter((b) => inPeriod(b.closed_at, period)).length,
    bugs_open: theBugs.filter((b) => b.status !== "closed").length,
    rows,
    counted_at,
  };
}

/** How far the work is from its plan: within 5 points is "on plan". */
export function againstPlan(f: Pick<ReportFacts, "completion" | "planned">): "ahead" | "on" | "behind" | null {
  if (f.planned === null) return null;
  const gap = f.completion - f.planned;
  return Math.abs(gap) < 0.05 ? "on" : gap > 0 ? "ahead" : "behind";
}

/** The report's first draft, written from its numbers in the writer's language. She edits it as she likes. */
export function draftSummary(f: ReportFacts, { tr, pct, day, lang }: Pick<Fmt, "tr" | "pct" | "day" | "lang">) {
  const name = (lang === "en" && f.about.label_en) || f.about.label || "";
  const label = (r: ReportRow) => (lang === "en" && r.label_en) || r.label;
  const lines = [
    tr(
      `من ${day(f.period.from)} إلى ${day(f.period.to)}: كان لدى ${name} ${f.assigned} مهمة، أُنجز منها ${f.done} (${pct(f.completion)}) وبقي ${f.left}.`,
      `From ${day(f.period.from)} to ${day(f.period.to)}: ${name} had ${f.assigned} tasks; ${f.done} were done (${pct(f.completion)}) and ${f.left} are left.`,
    ),
    f.late || f.blocked
      ? tr(`المهام المتأخرة: ${f.late}، والمتوقفة الآن: ${f.blocked}.`, `Late tasks: ${f.late}; blocked now: ${f.blocked}.`)
      : tr("لا مهام متأخرة ولا متوقفة.", "No late or blocked tasks."),
  ];
  if (f.on_time !== null) lines.push(tr(`أُنجز ${pct(f.on_time)} من المهام في موعدها.`, `${pct(f.on_time)} of the tasks were finished on time.`));
  const plan = againstPlan(f);
  if (plan && f.planned !== null) {
    const nums = tr(`المتوقع ${pct(f.planned)} والفعلي ${pct(f.completion)}`, `planned ${pct(f.planned)}, actual ${pct(f.completion)}`);
    lines.push(
      plan === "on"
        ? tr(`الإنجاز يسير وفق الخطة (${nums}).`, `The work is on plan (${nums}).`)
        : plan === "ahead"
          ? tr(`الإنجاز متقدم على الخطة (${nums}).`, `The work is ahead of plan (${nums}).`)
          : tr(`الإنجاز متأخر عن الخطة (${nums}).`, `The work is behind plan (${nums}).`),
    );
  }
  lines.push(
    tr(
      `الأخطاء: أُبلغ عن ${f.bugs_reported} وأُغلق ${f.bugs_closed} في الفترة، والمفتوح الآن ${f.bugs_open}.`,
      `Bugs: ${f.bugs_reported} reported and ${f.bugs_closed} closed in the period; ${f.bugs_open} open now.`,
    ),
  );
  const working = f.rows.filter((r) => r.assigned > 0);
  if (working.length > 1) {
    const best = [...working].sort((a, b) => b.completion - a.completion)[0];
    lines.push(tr(`الأعلى إنجازاً: ${label(best)} (${pct(best.completion)}).`, `Highest completion: ${label(best)} (${pct(best.completion)}).`));
    const latest = [...working].sort((a, b) => b.late - a.late)[0];
    if (latest.late) lines.push(tr(`الأكثر تأخراً: ${label(latest)} (المتأخرة: ${latest.late}).`, `Most late: ${label(latest)} (${latest.late} late).`));
  }
  return lines.join("\n");
}
