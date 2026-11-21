// THE CEO RULE (the client, 21 November 2026): the CEO may see and do everything any other job can, today and for
// everything added later (shared/lib/access.ts). This test keeps it true:
// 1. every permission rule (an exported function whose name starts with "can") in a feature's rules.ts or in
//    shared/lib/access.ts must be checked below. A NEW rule fails this test until it is added here, with the CEO
//    allowed, so nobody can add a permission and forget the CEO.
// 2. each rule says yes to the CEO, even in a project the CEO is not a member of.
// 3. the menu shows the CEO every item.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as admin from "@/features/admin/rules";
import * as announcements from "@/features/announcements/rules";
import * as bugs from "@/features/bugs/rules";
import * as chat from "@/features/chat/rules";
import * as monitoring from "@/features/monitoring/rules";
import * as performance from "@/features/performance/rules";
import * as projects from "@/features/projects/rules";
import * as reports from "@/features/reports/rules";
import * as tasks from "@/features/tasks/rules";
import type { User } from "@/shared/api/types";
import * as access from "@/shared/lib/access";
import { DEFAULT_STATUSES } from "@/shared/lib/statuses";

const ceo: User = { id: 1, name: "CEO", email: "ceo@x.test", role: "ceo", title: "", active: true };
const someone: User = { id: 7, name: "Someone", email: "s@x.test", role: "employee", title: "", team_id: 3, active: true };
// A project the CEO is NOT in, run by someone else.
const project = { id: 9, pm_id: 2, member_ids: [2, 7], statuses: DEFAULT_STATUSES };

/** Every rule, and how to ask it about the CEO. */
const CHECKS: Record<string, () => boolean> = {
  // shared/lib/access.ts
  canSeeProject: () => access.canSeeProject(ceo, project),
  canManageProjectSetup: () => access.canManageProjectSetup(ceo, project),
  canTakePart: () => access.canTakePart(ceo, project),
  // admin
  canAdminister: () => admin.canAdminister(ceo),
  canSeeAudit: () => admin.canSeeAudit(ceo),
  // announcements
  canPostAnnouncements: () => announcements.canPostAnnouncements(ceo),
  canManageAnnouncement: () => announcements.canManageAnnouncement(ceo, { author_id: 7 }),
  // bugs
  canReportBug: () => bugs.canReportBug(ceo, project),
  canManageBugs: () => bugs.canManageBugs(ceo, project),
  // chat
  canCreateGroupChat: () => chat.canCreateGroupChat(ceo),
  canStartDirect: () => chat.canStartDirect(ceo, someone),
  canWriteInDirect: () => chat.canWriteInDirect(ceo, someone, false),
  canManageGroupChat: () => chat.canManageGroupChat(ceo, { created_by: 7 }),
  // monitoring
  canWriteNotes: () => monitoring.canWriteNotes(ceo),
  canSendRequests: () => monitoring.canSendRequests(ceo),
  canSeeNote: () => monitoring.canSeeNote(ceo, { author_id: 3 }),
  canSendToCeo: () => monitoring.canSendToCeo(ceo, { author_id: 3 }),
  canUseCeoInbox: () => monitoring.canUseCeoInbox(ceo),
  // performance
  canSeePeoplePerf: () => performance.canSeePeoplePerf(ceo),
  canManageCriteria: () => performance.canManageCriteria(ceo),
  canReview: () => performance.canReview(ceo, someone, []),
  canSeePerson: () => performance.canSeePerson(ceo, someone, []),
  canSeeReview: () => performance.canSeeReview(ceo, { user_id: 7, reviewer_id: 4, state: "draft" }, someone, []),
  // projects
  canCreateProject: () => projects.canCreateProject(ceo),
  canManageProject: () => projects.canManageProject(ceo, project),
  canChangePm: () => projects.canChangePm(ceo),
  canUseTemplates: () => projects.canUseTemplates(ceo),
  canRemoveTemplate: () => projects.canRemoveTemplate(ceo, { created_by: 7 }),
  // reports
  canSeeReports: () => reports.canSeeReports(ceo),
  // tasks
  canManageTasks: () => tasks.canManageTasks(ceo, project),
  canApprove: () => tasks.canApprove(ceo, project),
  canMoveTask: () => tasks.canMoveTask(ceo, project, { assignee_id: 7 }),
  canComment: () => tasks.canComment(ceo, project),
};

/** The names of every exported `can…` rule in the features' rules.ts and in shared/lib/access.ts. */
function allRuleNames() {
  const files = [
    "src/shared/lib/access.ts",
    ...readdirSync("src/features").map((f) => join("src/features", f, "rules.ts")).filter((f) => {
      try {
        readFileSync(f);
        return true;
      } catch {
        return false;
      }
    }),
  ];
  const names = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(f, "utf8").matchAll(/export (?:function|const) (can[A-Z]\w*)/g)) names.add(m[1]);
  }
  return [...names].sort();
}

describe("the CEO rule: the CEO may do everything any job can", () => {
  it("every permission rule is checked here (a new rule must be added, with the CEO allowed)", () => {
    const missing = allRuleNames().filter((n) => !(n in CHECKS));
    expect(missing, `Add these rules to CHECKS in tests/unit/ceo-rule.test.ts, and let the CEO pass them: ${missing.join(", ")}`).toEqual([]);
  });

  for (const [name, check] of Object.entries(CHECKS)) {
    it(`${name} says yes to the CEO`, () => expect(check()).toBe(true));
  }

  it("the CEO does every status move of a bug", () => {
    for (const status of Object.keys(bugs.NEXT) as (keyof typeof bugs.NEXT)[]) {
      expect(bugs.movesFor(ceo, project, { status, assignee_id: 7, reported_by: 7 })).toEqual(bugs.NEXT[status].map((n) => n.to));
    }
  });

  it("the menu shows the CEO every item, also the ones added later", () => {
    expect(access.navFor("ceo")).toEqual(access.NAV);
  });
});
