import { describe, expect, it } from "vitest";
import { canApprove, canComment, canManageTasks, canMoveTask, planMove } from "@/features/tasks/rules";
import { seed } from "@/mock/seed";

const db = seed(new Date(2026, 10, 16));
const user = (id: number) => db.users.find((u) => u.id === id)!;
const booking = db.projects.find((p) => p.id === 1)!; // PM 2, members 2 4 5 6 7
const task = (code: string) => db.tasks.find((t) => t.code === code)!;

describe("who may do what with tasks", () => {
  it("the project's PM and its team leaders manage tasks; others don't", () => {
    expect(canManageTasks(user(2), booking)).toBe(true); // PM
    expect(canManageTasks(user(4), booking)).toBe(true); // team leader, member
    expect(canManageTasks(user(5), booking)).toBe(false); // employee
    expect(canManageTasks(user(1), booking)).toBe(false); // CEO: sees and approves, doesn't manage
  });

  it("the CEO may approve; an employee may not", () => {
    expect(canApprove(user(1), booking)).toBe(true);
    expect(canApprove(user(6), booking)).toBe(false);
  });

  it("an employee moves only their own tasks", () => {
    expect(canMoveTask(user(6), booking, task("TSK-121"))).toBe(true); // Ali's task
    expect(canMoveTask(user(5), booking, task("TSK-121"))).toBe(false); // Sara, not hers
  });

  it("the admin doesn't comment on project work; M&E does", () => {
    expect(canComment(user(8), booking)).toBe(false);
    expect(canComment(user(3), booking)).toBe(true);
  });
});

describe("planMove", () => {
  const ali = user(6);
  const t = task("TSK-121"); // Ali's, "new"

  it("asks for a reason before blocking", () => {
    expect(planMove(ali, booking, t, "blocked")).toBe("needs_reason");
    expect(planMove(ali, booking, t, "blocked", "   ")).toBe("needs_reason");
    expect(planMove(ali, booking, t, "blocked", "بانتظار الخادم")).toBe("move");
  });

  it("turns 'done' into an approval request for someone who may not approve", () => {
    expect(planMove(ali, booking, t, "completed")).toBe("request_approval");
    expect(planMove(user(2), booking, t, "completed")).toBe("move");
  });

  it("does nothing twice: the same status, or the same pending request", () => {
    expect(planMove(ali, booking, t, "new")).toBe("same");
    expect(planMove(ali, booking, task("TSK-099"), "completed")).toBe("same"); // already waiting
  });

  it("refuses others and unknown statuses", () => {
    expect(planMove(user(5), booking, t, "in_progress")).toBe("forbidden");
    expect(planMove(ali, booking, t, "no_such_status")).toBe("unknown");
  });
});
