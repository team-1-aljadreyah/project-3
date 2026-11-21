// The summary at the top of "My tasks": the counting (pure) and the shapes of its two charts.
import { describe, expect, it } from "vitest";
import type { Project } from "@/features/projects/types";
import { arcPath, pointAt, ringPiece, ringSegments } from "@/features/tasks/chart-shapes";
import { byTone, myNumbers, openByProject, TONE_ORDER, toneName, toneOf } from "@/features/tasks/my-summary";
import type { Task } from "@/features/tasks/types";
import { DEFAULT_STATUSES } from "@/shared/lib/statuses";

const TODAY = "2026-11-16";

type P = Pick<Project, "id" | "name" | "name_en" | "statuses">;
const booking: P = { id: 1, name: "منصة الحجز", name_en: "Booking", statuses: DEFAULT_STATUSES };
const sales: P = { id: 2, name: "تطبيق المبيعات", name_en: "Sales app", statuses: DEFAULT_STATUSES };
// A project with its own statuses: one more "review" status and one more "done" status (the brief allows both).
const campaign: P = {
  id: 3,
  name: "حملة الشتاء",
  statuses: [
    ...DEFAULT_STATUSES,
    { key: "approval", name: "بانتظار موافقة الإدارة", name_en: "Awaiting approval", tone: "review" },
    { key: "delivered", name: "سُلّمت", name_en: "Delivered", tone: "done" },
  ],
};
const projects = [booking, sales, campaign];

let nextId = 0;
const task = (over: Partial<Task>): Task => ({
  id: ++nextId,
  code: `TSK-${nextId}`,
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
const pending = { state: "pending" as const, from: "in_progress", to: "completed", requested_by: 5, requested_at: "2026-11-16T09:00:00Z" };

describe("myNumbers", () => {
  it("counts open and done, and the done share", () => {
    const n = myNumbers([task({ status: "completed" }), task({ status: "in_progress" }), task({ status: "new" }), task({ status: "blocked" })], projects, TODAY);
    expect(n).toMatchObject({ total: 4, open: 3, done: 1, ratio: 0.25 });
  });

  it("gives 0% with no tasks (no division by zero)", () => {
    expect(myNumbers([], projects, TODAY)).toEqual({ total: 0, open: 0, done: 0, ratio: 0, dueToday: 0, dueWeek: 0, late: 0, longestLate: 0, inReview: 0, awaitingApproval: 0 });
  });

  it("treats a project's own done status as done", () => {
    const n = myNumbers([task({ project_id: 3, status: "delivered" }), task({ project_id: 3, status: "todo" })], projects, TODAY);
    expect(n).toMatchObject({ done: 1, open: 1, ratio: 0.5 });
  });

  it("counts what is due today, and what is due in the next 7 days (today and the six days after it)", () => {
    const n = myNumbers(
      [
        task({ due: TODAY }),
        task({ due: "2026-11-17" }),
        task({ due: "2026-11-22" }), // the 7th day: still in
        task({ due: "2026-11-23" }), // the 8th day: out
        task({ due: "2026-11-15" }), // yesterday: late, not "this week"
        task({}), // no due day
      ],
      projects,
      TODAY,
    );
    expect(n).toMatchObject({ dueToday: 1, dueWeek: 3, late: 1 });
  });

  it("counts late tasks and the longest delay; a task due today is not late", () => {
    const n = myNumbers([task({ due: "2026-11-14" }), task({ due: "2026-11-09" }), task({ due: TODAY })], projects, TODAY);
    expect(n).toMatchObject({ late: 2, longestLate: 7 });
  });

  it("never counts a done task as late or due, however old its due day", () => {
    const n = myNumbers([task({ status: "completed", due: "2026-11-01" }), task({ status: "completed", due: TODAY })], projects, TODAY);
    expect(n).toMatchObject({ done: 2, open: 0, late: 0, longestLate: 0, dueToday: 0, dueWeek: 0 });
  });

  it("counts as in review: a review status (a project's own too), or a completion that waits for approval", () => {
    const n = myNumbers(
      [
        task({ status: "in_review" }),
        task({ project_id: 3, status: "approval" }),
        task({ status: "in_progress", approval: pending }),
        // In review AND waiting for approval: one task, counted once.
        task({ status: "in_review", approval: { ...pending, from: "in_review" } }),
        task({ status: "in_progress", approval: { ...pending, state: "rejected" } }),
        task({ status: "testing" }),
      ],
      projects,
      TODAY,
    );
    expect(n).toMatchObject({ inReview: 4, awaitingApproval: 2, open: 6 });
  });

  it("keeps a task whose project isn't in the list open and never late, like the list under the summary", () => {
    const n = myNumbers([task({ project_id: 99, status: "completed", due: "2026-11-01" })], projects, TODAY);
    expect(n).toMatchObject({ total: 1, open: 1, done: 0, late: 0 });
  });
});

describe("openByProject", () => {
  it("gives one bar per project with open tasks, the most first, with its length against the longest", () => {
    const bars = openByProject(
      [task({ project_id: 2 }), task({ project_id: 1 }), task({ project_id: 1 }), task({ project_id: 1, status: "in_review" }), task({ project_id: 1 }), task({ project_id: 3, status: "approval" }), task({ project_id: 3 })],
      projects,
    );
    expect(bars.map((b) => [b.id, b.open, b.length])).toEqual([
      [1, 4, 1],
      [3, 2, 0.5],
      [2, 1, 0.25],
    ]);
    expect(bars[0]).toMatchObject({ name: "منصة الحجز", name_en: "Booking" });
  });

  it("keeps the list's order between projects with the same count", () => {
    const bars = openByProject([task({ project_id: 3 }), task({ project_id: 2 }), task({ project_id: 1 })], projects);
    expect(bars.map((b) => b.id)).toEqual([1, 2, 3]);
  });

  it("leaves out a project where everything of mine is done, and tasks of a project that isn't in the list", () => {
    const bars = openByProject([task({ project_id: 1, status: "completed" }), task({ project_id: 3, status: "delivered" }), task({ project_id: 99 }), task({ project_id: 2 })], projects);
    expect(bars.map((b) => b.id)).toEqual([2]);
    expect(openByProject([task({ status: "completed" })], projects)).toEqual([]);
  });
});

describe("byTone", () => {
  it("groups every task (done ones too) by status family, in board order, with each family's share", () => {
    const slices = byTone(
      [task({ status: "blocked" }), task({ status: "completed" }), task({ status: "in_progress" }), task({ status: "in_progress" }), task({ status: "new" }), task({ status: "testing" }), task({ status: "todo" }), task({ status: "in_review" })],
      projects,
    );
    expect(slices.map((s) => s.tone)).toEqual(TONE_ORDER);
    expect(slices.find((s) => s.tone === "progress")).toEqual({ tone: "progress", count: 2, share: 0.25 });
    expect(slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });

  it("leaves out the families with no task", () => {
    expect(byTone([task({ status: "new" }), task({ status: "in_progress" })], projects)).toEqual([
      { tone: "new", count: 1, share: 0.5 },
      { tone: "progress", count: 1, share: 0.5 },
    ]);
    expect(byTone([], projects)).toEqual([]);
  });

  it("puts a project's own statuses in their family", () => {
    const slices = byTone([task({ project_id: 3, status: "approval" }), task({ status: "in_review" }), task({ project_id: 3, status: "delivered" })], projects);
    expect(slices.map((s) => [s.tone, s.count])).toEqual([
      ["review", 2],
      ["done", 1],
    ]);
  });
});

describe("toneOf and toneName", () => {
  it("counts a status the project no longer has with the project's first status, like the board does", () => {
    expect(toneOf(booking, { status: "removed_status" })).toBe("new");
    expect(toneOf({ statuses: [{ key: "doing", name: "جارية", name_en: "Doing", tone: "progress" }] }, { status: "removed_status" })).toBe("progress");
  });

  it("counts a task with no project as new", () => {
    expect(toneOf(undefined, { status: "completed" })).toBe("new");
  });

  it("names every family after its base status", () => {
    expect(TONE_ORDER.map((tone) => toneName(tone).en)).toEqual(["New", "To do", "In progress", "In review", "Testing", "Completed", "Blocked"]);
    expect(toneName("review").ar).toBe("قيد المراجعة");
  });
});

describe("the charts' shapes", () => {
  it("finds points on a circle: turn 0 is the top, then clockwise", () => {
    expect(pointAt(100, 100, 50, 0)).toEqual({ x: 100, y: 50 });
    expect(pointAt(100, 100, 50, 0.25)).toEqual({ x: 150, y: 100 });
    expect(pointAt(100, 100, 50, 0.5)).toEqual({ x: 100, y: 150 });
    expect(pointAt(100, 100, 50, 0.75)).toEqual({ x: 50, y: 100 });
  });

  it("draws the gauge's half ring from the left over the top to the right", () => {
    expect(arcPath(100, 100, 84, 0.75, 1.25)).toBe("M 16 100 A 84 84 0 0 1 184 100");
    // A quarter of the gauge is done: the line stops half-way up the left side.
    expect(arcPath(100, 100, 84, 0.75, 0.875)).toBe("M 16 100 A 84 84 0 0 1 40.6 40.6");
    // More than half a turn takes the long way round.
    expect(arcPath(100, 100, 50, 0, 0.75)).toBe("M 100 50 A 50 50 0 1 1 50 100");
  });

  it("splits a ring in proportion, after every piece got its pad", () => {
    const pieces = ringSegments([0.5, 0.25, 0.25], 0.04);
    // 3 pads of 0.04 leave 0.88 to share: 0.04 + 0.44, then 0.04 + 0.22 twice.
    expect(pieces.map((p) => p.to - p.from)).toEqual([expect.closeTo(0.48), expect.closeTo(0.26), expect.closeTo(0.26)]);
    // One after the other, all the way round.
    expect(pieces[0].from).toBe(0);
    expect(pieces[1].from).toBe(pieces[0].to);
    expect(pieces[2].to).toBeCloseTo(1);
  });

  it("keeps even a tiny share visible, and never goes past the full ring", () => {
    const pieces = ringSegments([0.99, 0.01], 0.04);
    expect(pieces[1].to - pieces[1].from).toBeGreaterThan(0.04);
    // More pieces than pads fit: they share the ring equally.
    const many = ringSegments(Array.from({ length: 40 }, () => 1 / 40), 0.04);
    expect(many.at(-1)!.to).toBeCloseTo(1);
    expect(many[0].to - many[0].from).toBeCloseTo(1 / 40);
  });

  it("draws a piece of the ring between two radii", () => {
    // The top-right quarter with no inset: along the rim, in to the hole, back along the hole.
    expect(ringPiece(80, 80, 40, 60, 0, 0.25, 0)).toBe("M 80 20 A 60 60 0 0 1 140 80 L 120 80 A 40 40 0 0 0 80 40 Z");
    // More than half the ring takes the long way round on both circles.
    expect(ringPiece(80, 80, 40, 60, 0, 0.75, 0)).toBe("M 80 20 A 60 60 0 1 1 20 80 L 40 80 A 40 40 0 1 0 80 40 Z");
  });

  it("moves a piece's ends in by the same distance at the rim and at the hole, so the gap has one width", () => {
    const path = ringPiece(80, 80, 40, 60, 0, 0.25, 5);
    // The piece starts at the top, where the cut is the upright line x = 80: both corners sit 5 to its right.
    expect(path.startsWith("M 85 ")).toBe(true);
    expect(path.endsWith(" 85 40.31 Z")).toBe(true);
    // It ends at the right, where the cut is the level line y = 80: both corners sit 5 above it.
    expect(path).toContain("1 139.79 75 L 119.69 75 A");
  });
});
