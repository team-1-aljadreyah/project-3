// Teams and structure: who is in which team and what is wrong with it, as a pure function (no React, no network), so
// it is easy to test (tests/unit/admin-console.test.ts). The structure page shows it and fixes it with the existing
// calls (PATCH /admin/users/:id for a team, PATCH /admin/teams/:id for a leader).
import type { Team } from "@/shared/api/types";
import { needsTeam } from "./health";
import type { AdminUser } from "./types";

export interface TeamShape {
  team: Team;
  /** The leader, when the team has one who is active. */
  leader?: AdminUser;
  /** The active people in the team, the leader not counted. */
  members: AdminUser[];
}

export interface Structure {
  teams: TeamShape[];
  /** Active employees (and leaders of a team) in no team; the CEO, PMs, monitoring and the admin work across teams. */
  noTeam: AdminUser[];
  /** Teams with no active leader. */
  noLeader: TeamShape[];
  /** Teams whose leader has nobody to lead. */
  leaderAlone: TeamShape[];
  /** Active team leaders who lead no team. */
  idleLeads: AdminUser[];
}

/** The teams with their people, and the four kinds of problem. */
export function structureOf(users: AdminUser[], teams: Team[]): Structure {
  const active = users.filter((u) => u.active);
  const shaped = teams.map((team): TeamShape => {
    const leader = active.find((u) => u.id === team.lead_id);
    return { team, leader, members: active.filter((u) => u.team_id === team.id && u.id !== leader?.id) };
  });
  const leading = new Set(shaped.map((t) => t.leader?.id).filter((id): id is number => id !== undefined));
  const idle = (u: AdminUser) => u.role === "lead" && !leading.has(u.id);
  return {
    teams: shaped,
    // A team leader in no team who leads none is listed once, with the leaders (leading a team puts them in it).
    noTeam: active.filter((u) => needsTeam(u) && !idle(u)),
    noLeader: shaped.filter((t) => !t.leader),
    leaderAlone: shaped.filter((t) => t.leader && t.members.length === 0),
    idleLeads: active.filter(idle),
  };
}

/** How many things the structure page asks to fix. */
export const structureProblems = (s: Structure) => s.noTeam.length + s.noLeader.length + s.leaderAlone.length + s.idleLeads.length;
