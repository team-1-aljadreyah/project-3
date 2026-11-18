import { describe, expect, it } from "vitest";
import { countTasks, groupByStatus, isDone, lateDays, plannedRatio } from "@/features/projects/counts";
import type { Project } from "@/features/projects/types";
import type { Task } from "@/features/tasks/types";
import { DEFAULT_STATUSES } from "@/shared/lib/statuses";

const project: Pick<Project, "statuses"> = { statuses: DEFAULT_STATUSES };

const task = (over: Partial<Task>): Task => ({
  id: 1,
  code: "TSK-1",
  project_id: 1,
  title: "t",
  description: "",
  priority: "medium",
  status: "new",
  subtasks_done: 0,
  subtasks_total: 0,
  updated_at: "2026-11-16T00:00:00Z",
  ...over,
});

describe("the default statuses", () => {
  it("has the seven statuses of the brief, in board order", () => {
    expect(DEFAULT_STATUSES.map((s) => s.key)).toEqual(["new", "todo", "in_progress", "in_review", "testing", "completed", "blocked"]);
  });
});

describe("groupByStatus", () => {
  it("makes one column per project status, in the project's order", () => {
    const cols = groupByStatus(project, [task({ id: 1, status: "testing" }), task({ id: 2, status: "new" })]);
    expect(cols.map((c) => c.status.key)).toEqual(DEFAULT_STATUSES.map((s) => s.key));
    expect(cols.find((c) => c.status.key === "testing")?.tasks.map((t) => t.id)).toEqual([1]);
  });

  it("never loses a task whose status the project no longer has: it shows in the first column", () => {
    const cols = groupByStatus(project, [task({ id: 9, status: "removed_status" })]);
    expect(cols[0].tasks.map((t) => t.id)).toEqual([9]);
  });

  it("follows a project's own statuses", () => {
    const custom = { statuses: [...DEFAULT_STATUSES, { key: "approval", name: "بانتظار الموافقة", name_en: "Approval", tone: "review" as const }] };
    const cols = groupByStatus(custom, [task({ status: "approval" })]);
    expect(cols.at(-1)?.tasks).toHaveLength(1);
  });
});

describe("lateDays", () => {
  it("counts the days past the due day", () => {
    expect(lateDays(project, task({ due: "2026-11-14" }), "2026-11-16")).toBe(2);
  });

  it("is 0 on the due day and before it", () => {
    expect(lateDays(project, task({ due: "2026-11-16" }), "2026-11-16")).toBe(0);
    expect(lateDays(project, task({ due: "2026-11-20" }), "2026-11-16")).toBe(0);
  });

  it("is 0 for a done task or one with no due day", () => {
    expect(lateDays(project, task({ due: "2026-11-01", status: "completed" }), "2026-11-16")).toBe(0);
    expect(lateDays(project, task({}), "2026-11-16")).toBe(0);
  });
});

describe("countTasks", () => {
  it("counts done, late, blocked and in review", () => {
    const list = [
      task({ id: 1, status: "completed", due: "2026-11-01" }),
      task({ id: 2, status: "in_progress", due: "2026-11-10" }),
      task({ id: 3, status: "blocked", due: "2026-11-20" }),
      task({ id: 4, status: "in_review" }),
    ];
    expect(countTasks(project, list, "2026-11-16")).toEqual({ total: 4, done: 1, late: 1, blocked: 1, inReview: 1, ratio: 0.25 });
  });

  it("gives 0% for an empty project (no division by zero)", () => {
    expect(countTasks(project, [], "2026-11-16").ratio).toBe(0);
  });

  it("treats any status of the done family as done", () => {
    const custom = { statuses: [...DEFAULT_STATUSES, { key: "delivered", name: "سُلّمت", name_en: "Delivered", tone: "done" as const }] };
    expect(isDone(custom, { status: "delivered" })).toBe(true);
  });
});

describe("plannedRatio", () => {
  it("is where an even plan should be on a day", () => {
    expect(plannedRatio("2026-11-10", "2026-11-20", "2026-11-16")).toBeCloseTo(0.6);
  });

  it("stays between 0 and 1 before and after the sprint", () => {
    expect(plannedRatio("2026-11-10", "2026-11-20", "2026-11-01")).toBe(0);
    expect(plannedRatio("2026-11-10", "2026-11-20", "2026-11-30")).toBe(1);
  });
});
