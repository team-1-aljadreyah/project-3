// The data shapes of the dashboard and the reports. The server counts them over the projects the person may see.
import type { ProjectState } from "@/features/projects";

/** One project's numbers: tasks, and progress against the plan (time gone). */
export interface ProjectRow {
  id: number;
  code: string;
  name: string;
  name_en?: string;
  state: ProjectState;
  pm_id: number;
  start: string;
  end: string;
  total: number;
  done: number;
  late: number;
  blocked: number;
  /** Done / total, 0–1. */
  ratio: number;
  /** Where the plan says it should be today (days gone / project length), 0–1. */
  planned_ratio: number;
  /** Past its expected end day and not done. */
  overdue: boolean;
  /** Active, and its progress is more than 15 points behind the plan. */
  behind: boolean;
}

/** One person's tasks in the projects shown. */
export interface PersonRow {
  user_id: number;
  team_id?: number;
  open: number;
  done: number;
  late: number;
  blocked: number;
  in_review: number;
}

/** One team: its people's tasks added up (the brief: "team levels"). */
export interface TeamRow {
  team_id: number;
  name: string;
  name_en?: string;
  members: number;
  open: number;
  done: number;
  late: number;
  /** Done / all its tasks, 0–1. */
  ratio: number;
}

/** One sprint (the brief: planned, done, left, velocity). */
export interface SprintRow {
  project_id: number;
  sprint_id: number;
  name: string;
  start: string;
  end: string;
  closed: boolean;
  planned: number;
  done: number;
  left: number;
}

export interface BugCounts {
  open: number;
  late: number;
  closed: number;
  critical_open: number;
}

export interface Overview {
  /** The day the numbers are for. */
  today: string;
  projects: ProjectRow[];
  people: PersonRow[];
  teams: TeamRow[];
  sprints: SprintRow[];
  bugs: BugCounts;
}
