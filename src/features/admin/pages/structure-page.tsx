import { arN, W } from "@/shared/lib/count-words";
import { CircleCheck, Crown, UserX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Team } from "@/shared/api/types";
import { useFmt } from "@/shared/lib/i18n";
import { usePageTitle } from "@/shared/lib/page-title";
import { roleName } from "@/shared/lib/site";
import { useUser } from "@/shared/lib/session";
import { useLoad } from "@/shared/lib/use-load";
import { cn } from "@/shared/lib/utils";
import { Avatar, Button, Empty, ErrorBox, errorText, LoadingBlock, Select, Skeleton, useToast } from "@/shared/ui";
import { adminApi } from "../api";
import { Panel } from "../components/panel";
import { UserDialog } from "../components/user-dialog";
import { TEAM_JOBS } from "../health";
import { canAdminister } from "../rules";
import { structureOf, structureProblems, type Structure } from "../structure";
import type { AdminUser } from "../types";

/**
 * Teams and structure (/admin/structure): who is in which team, and what is wrong with it (people of a team job in no
 * team, teams with no leader, a leader with nobody to lead, a team leader leading no team), each fixed on the spot with
 * the existing calls: a team for a person (PATCH /admin/users/:id), a leader for a team (PATCH /admin/teams/:id).
 */
export function StructurePage() {
  const { tr } = useFmt();
  usePageTitle(tr("الهيكل التنظيمي", "Structure"));
  const me = useUser();
  const allowed = canAdminister(me);
  const load = useLoad(() => (allowed ? Promise.all([adminApi.users(), adminApi.teams()]) : Promise.resolve(null)), [allowed]);
  const s = useMemo(() => (load.data ? structureOf(load.data[0], load.data[1]) : null), [load.data]);

  if (!allowed) return <Empty title={tr("هذه الصفحة لمسؤول النظام والمدير التنفيذي", "This page is for the system admin and the CEO")} />;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{tr("الهيكل التنظيمي", "Structure")}</h1>
        <p className="text-sm text-muted">{tr("من في أي فريق، ومن يقوده، وما يحتاج إلى إصلاح.", "Who is in which team, who leads it, and what needs fixing.")}</p>
      </header>
      {load.state.status === "loading" ? (
        <LoadingBlock className="flex flex-col gap-5">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </LoadingBlock>
      ) : load.state.status === "error" ? (
        <ErrorBox error={load.state.error} onRetry={load.reload} />
      ) : load.data && s ? (
        <StructureBody s={s} users={load.data[0]} teams={load.data[1]} me={me.id} reload={load.reload} />
      ) : null}
    </div>
  );
}

function StructureBody({ s, users, teams, me, reload }: { s: Structure; users: AdminUser[]; teams: Team[]; me: number; reload: () => void }) {
  const { tr, num, lang } = useFmt();
  const toast = useToast();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const nameOf = (u: { name: string; name_en?: string }) => (lang === "en" && u.name_en ? u.name_en : u.name);
  const problems = structureProblems(s);
  const activeLeads = users.filter((u) => u.active && u.role === "lead");
  const leading = new Map(s.teams.filter((t) => t.leader).map((t) => [t.leader!.id, t.team]));

  const save = async (job: () => Promise<unknown>, done: string) => {
    setError(undefined);
    try {
      await job();
      toast(done);
      reload();
    } catch (e) {
      setError(errorText(e, tr));
    }
  };
  const setTeam = (u: AdminUser, teamId: number) => {
    const t = teams.find((x) => x.id === teamId)!;
    return save(() => adminApi.updateUser(u.id, { team_id: teamId }), tr(`${nameOf(u)} الآن في ${nameOf(t)}.`, `${nameOf(u)} is now in ${nameOf(t)}.`));
  };
  const setLeader = (team: Team, leadId: number) => {
    const u = users.find((x) => x.id === leadId)!;
    return save(() => adminApi.updateTeam(team.id, { name: team.name, name_en: team.name_en, lead_id: leadId }), tr(`${nameOf(u)} يقود ${nameOf(team)} الآن.`, `${nameOf(u)} now leads ${nameOf(team)}.`));
  };

  const across = users.filter((u) => u.active && !(TEAM_JOBS as readonly string[]).includes(u.role));
  const stopped = users.filter((u) => !u.active).length;

  return (
    <>
      {error && (
        <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Panel
        id="fix"
        title={problems ? tr(`بحاجة إلى إصلاح (${num(problems)})`, `Needs fixing (${problems})`) : tr("بحاجة إلى إصلاح", "Needs fixing")}
        note={tr("أصلح كل سطر في مكانه: يُحفظ ويُسجَّل في سجل العمليات، ويُبلَّغ الشخص بفريقه.", "Fix each line where it is: it is saved and logged, and the person is told their team.")}
      >
        {problems === 0 ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
            <CircleCheck size={16} aria-hidden="true" className="text-success" />
            {tr("الهيكل سليم: كل موظف وقائد في فريق، ولكل فريق قائد وأعضاء.", "All in order: every employee and leader is in a team, and every team has a leader and members.")}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {s.noTeam.length > 0 && (
              <FixGroup id="no-team" title={tr(`بلا فريق (${num(s.noTeam.length)})`, `In no team (${s.noTeam.length})`)} note={tr("موظفون وقادة فرق لا ينتمون إلى أي فريق.", "Employees and team leaders who belong to no team.")}>
                {s.noTeam.map((u) => (
                  <PickRow
                    key={u.id}
                    person={u}
                    sub={[roleName(u, lang), u.title].filter(Boolean).join(" · ")}
                    label={tr(`فريق ${nameOf(u)}`, `${nameOf(u)}'s team`)}
                    choices={teams.map((t) => ({ value: t.id, label: nameOf(t) }))}
                    empty={tr("لا فرق بعد: أنشئ فريقاً أولاً.", "No teams yet: make a team first.")}
                    action={tr("عيّن", "Assign")}
                    onPick={(id) => setTeam(u, id)}
                  />
                ))}
              </FixGroup>
            )}
            {s.noLeader.length > 0 && (
              <FixGroup id="no-leader" title={tr(`فرق بلا قائد (${num(s.noLeader.length)})`, `Teams with no leader (${s.noLeader.length})`)} note={tr("يُختار القائد من أصحاب دور «قائد الفريق».", "The leader is one of the people with the team leader job.")}>
                {s.noLeader.map((t) => (
                  <PickRow
                    key={t.team.id}
                    team={nameOf(t.team)}
                    sub={tr(`${arN(t.members.length, W.member)}`, `${t.members.length} members`)}
                    label={tr(`قائد ${nameOf(t.team)}`, `${nameOf(t.team)}'s leader`)}
                    choices={activeLeads.map((u) => ({ value: u.id, label: leading.has(u.id) ? tr(`${nameOf(u)} (يقود ${nameOf(leading.get(u.id)!)})`, `${nameOf(u)} (leads ${nameOf(leading.get(u.id)!)})`) : nameOf(u) }))}
                    empty={tr("لا أحد بدور «قائد الفريق»: غيّر دور أحدهم من قائمة المستخدمين.", "Nobody has the team leader job: change someone's job in the users list.")}
                    action={tr("اجعله القائد", "Make leader")}
                    onPick={(id) => setLeader(t.team, id)}
                  />
                ))}
              </FixGroup>
            )}
            {s.idleLeads.length > 0 && (
              <FixGroup id="idle-leads" title={tr(`قادة لا يقودون فريقاً (${num(s.idleLeads.length)})`, `Team leaders leading no team (${s.idleLeads.length})`)}>
                {s.idleLeads.map((u) => (
                  <PickRow
                    key={u.id}
                    person={u}
                    sub={u.title}
                    label={tr(`الفريق الذي يقوده ${nameOf(u)}`, `The team ${nameOf(u)} leads`)}
                    choices={s.teams.map((t) => ({ value: t.team.id, label: t.leader ? tr(`${nameOf(t.team)} (بدلاً من ${nameOf(t.leader)})`, `${nameOf(t.team)} (instead of ${nameOf(t.leader)})`) : nameOf(t.team) }))}
                    empty={tr("لا فرق بعد: أنشئ فريقاً أولاً.", "No teams yet: make a team first.")}
                    action={tr("اجعله القائد", "Make leader")}
                    onPick={(id) => setLeader(teams.find((t) => t.id === id)!, u.id)}
                  />
                ))}
              </FixGroup>
            )}
            {s.leaderAlone.length > 0 && (
              <FixGroup id="alone" title={tr(`قائد بلا أعضاء (${num(s.leaderAlone.length)})`, `A leader with no members (${s.leaderAlone.length})`)}>
                {s.leaderAlone.map((t) => (
                  <li key={t.team.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{nameOf(t.team)}</span>
                      <span className="text-xs text-muted">{tr(`القائد ${nameOf(t.leader!)} ولا أحد غيره في الفريق.`, `${nameOf(t.leader!)} leads it, and nobody else is in it.`)}</span>
                    </span>
                    <Link href={s.noTeam.length ? "#no-team" : "/admin?tab=users"} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                      {s.noTeam.length ? tr("عيّن له أعضاء من «بلا فريق»", "Assign members from \"In no team\"") : tr("اختر أعضاءه من المستخدمين", "Pick its members in the users")}
                    </Link>
                  </li>
                ))}
              </FixGroup>
            )}
          </div>
        )}
      </Panel>

      <Panel id="teams" title={tr("الفرق وأعضاؤها", "Teams and their people")} note={tr("اضغط على شخص لتغيير فريقه أو دوره.", "Press a person to change their team or job.")}>
        {s.teams.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">{tr("لا فرق بعد.", "No teams yet.")}</p>
        ) : (
          // Each team draws its bottom and end lines; negative margins push the outer ones under the panel's edge.
          <ul aria-label={tr("الفرق", "Teams")} className="-me-px -mb-px grid md:grid-cols-2 xl:grid-cols-3">
            {s.teams.map((t) => (
              <li key={t.team.id} className="flex flex-col gap-3 border-e border-b border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 flex-col">
                    <b dir="auto">{nameOf(t.team)}</b>
                    <span className="text-xs text-muted">{tr(`${arN(t.members.length + (t.leader ? 1 : 0), W.person)}`, `${t.members.length + (t.leader ? 1 : 0)} people`)}</span>
                  </span>
                  {!t.leader && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-danger px-1.5 py-px text-xs text-danger">
                      <UserX size={12} aria-hidden="true" />
                      {tr("بلا قائد", "No leader")}
                    </span>
                  )}
                </div>
                {/* A small tree: the leader on top, the members on a line under them. */}
                <div className="flex flex-col">
                  {t.leader && <Member user={t.leader} lead onOpen={setEditing} />}
                  <ul aria-label={tr(`أعضاء ${nameOf(t.team)}`, `${nameOf(t.team)} members`)} className={cn("flex flex-col", t.leader && "ms-4 border-s border-line-strong ps-3")}>
                    {t.members.map((u) => (
                      <li key={u.id} className={cn("relative", t.leader && "before:absolute before:top-1/2 before:-start-3 before:h-px before:w-3 before:bg-line-strong")}>
                        <Member user={u} onOpen={setEditing} />
                      </li>
                    ))}
                    {!t.members.length && <li className="py-1.5 text-xs text-faint">{tr("لا أعضاء بعد", "No members yet")}</li>}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        )}
        {across.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
            <p className="text-xs font-medium text-muted">{tr("يعملون على مستوى الشركة (لا يحتاجون فريقاً)", "Work across teams (need no team)")}</p>
            <ul className="flex flex-wrap gap-1.5">
              {across.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => setEditing(u)} className="flex items-center gap-1.5 rounded-full border border-line bg-card-2 py-0.5 ps-0.5 pe-2.5 text-xs hover:border-accent">
                    <span aria-hidden="true" className="flex">
                      <Avatar user={u} size="sm" />
                    </span>
                    {nameOf(u)} · <span className="text-muted">{roleName(u, lang)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {stopped > 0 && <p className="border-t border-line px-4 py-2 text-xs text-faint">{tr(`الحسابات الموقوفة لا تظهر هنا: ${num(stopped)}.`, `${stopped} stopped accounts are not shown here.`)}</p>}
      </Panel>
      {editing && <UserDialog user={editing} teams={teams} me={me} onClose={() => setEditing(null)} onSaved={reload} />}
    </>
  );
}

function FixGroup({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-label={title} className="scroll-mt-24 px-4 py-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {note && <p className="text-xs text-muted">{note}</p>}
      <ul className="mt-1 flex flex-col divide-y divide-line">{children}</ul>
    </section>
  );
}

/** One line to fix: who or which team, and a choice with its button. */
function PickRow({
  person,
  team,
  sub,
  label,
  choices,
  empty,
  action,
  onPick,
}: {
  person?: AdminUser;
  team?: string;
  sub?: string;
  label: string;
  choices: { value: number; label: string }[];
  empty: string;
  action: string;
  onPick: (value: number) => Promise<void> | void;
}) {
  const { tr, lang } = useFmt();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    if (!value) return;
    setBusy(true);
    await onPick(Number(value));
    setBusy(false);
  };
  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      {person && (
        <span aria-hidden="true" className="flex">
          <Avatar user={person} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{person ? (lang === "en" && person.name_en ? person.name_en : person.name) : team}</span>
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </span>
      {choices.length === 0 ? (
        <span className="text-xs text-muted">{empty}</span>
      ) : (
        <span className="flex w-full items-center gap-2 sm:w-auto">
          <Select aria-label={label} value={value} onChange={(e) => setValue(e.target.value)} className="h-9 min-w-0 flex-1 sm:w-56 sm:flex-none">
            <option value="">{tr("اختر…", "Choose…")}</option>
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={pick} disabled={!value || busy}>
            {action}
          </Button>
        </span>
      )}
    </li>
  );
}

function Member({ user, lead, onOpen }: { user: AdminUser; lead?: boolean; onOpen: (u: AdminUser) => void }) {
  const { tr, lang } = useFmt();
  return (
    // The whole row opens the person (click anywhere).
    <button type="button" onClick={() => onOpen(user)} className="-mx-1.5 flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start hover:bg-card-2">
      <span aria-hidden="true" className="flex">
        <Avatar user={user} size={lead ? "md" : "sm"} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-sm", lead && "font-semibold")}>{lang === "en" && user.name_en ? user.name_en : user.name}</span>
        {user.title && <span className="truncate text-xs text-muted">{user.title}</span>}
      </span>
      {lead && (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
          <Crown size={12} aria-hidden="true" />
          {tr("القائد", "Leader")}
        </span>
      )}
    </button>
  );
}
