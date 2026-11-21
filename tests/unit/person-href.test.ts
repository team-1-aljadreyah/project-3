// A person's name links to their performance page only when the viewer may open it: personHref (shared, for names
// anywhere in the site) must never link where the performance rule canSeePerson says no.
import { describe, expect, it } from "vitest";
import { canSeePerson } from "@/features/performance/rules";
import { seed } from "@/mock/seed";
import { personHref } from "@/shared/lib/access";

describe("personHref", () => {
  const db = seed();
  const people = db.users.filter((u) => u.active);

  it("never links where canSeePerson says no, for every pair of demo people", () => {
    for (const viewer of people) {
      for (const person of people) {
        const href = personHref(viewer, person, db.projects);
        if (href) expect(canSeePerson(viewer, person, db.projects), `${viewer.role} ${viewer.id} → ${person.id}`).toBe(true);
      }
    }
  });

  it("links everyone's work for the CEO and M&E, yourself always, and nothing for an employee looking at others", () => {
    const [ceo, , monitor, , employee] = [1, 2, 3, 4, 5].map((id) => people.find((u) => u.id === id)!);
    const sara = people.find((u) => u.id === 5)!;
    expect(personHref(ceo, sara)).toBe("/performance/5");
    expect(personHref(monitor, sara)).toBe("/performance/5");
    expect(personHref(employee, employee)).toBe("/performance/5");
    expect(personHref(employee, people.find((u) => u.id === 6)!)).toBeUndefined();
    // The CEO and the admin have no numbers to open; without the job there is no link rather than a wrong one.
    expect(personHref(monitor, ceo)).toBeUndefined();
    expect(personHref(ceo, { id: 6 })).toBeUndefined();
  });

  it("a PM links the people in the projects they run; a team leader the employees of their team", () => {
    const pm = people.find((u) => u.id === 2)!;
    const lead = people.find((u) => u.id === 4)!;
    const sara = people.find((u) => u.id === 5)!;
    expect(personHref(pm, sara, db.projects)).toBe("/performance/5");
    expect(personHref(pm, sara)).toBeUndefined();
    expect(personHref(lead, sara)).toBe("/performance/5");
    expect(personHref(lead, { ...sara, team_id: 99 })).toBeUndefined();
  });
});
