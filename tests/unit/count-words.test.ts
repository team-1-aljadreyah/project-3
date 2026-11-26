import { describe, expect, it } from "vitest";
import { arN, enN, G, W } from "@/shared/lib/count-words";

// 26 November 2026 (the client: "there are a few problems and wrong translations"): a number and its noun agree in
// Arabic, which the pages used to get wrong ("1 أعضاء"، "5 مهمة"، "12 أعضاء").
describe("Arabic counts", () => {
  it("1 and 2 have their own words; 3–10 the plural; 11–99 the singular", () => {
    expect([1, 2, 3, 10, 11, 99].map((n) => arN(n, W.member))).toEqual(["عضو واحد", "عضوان", "3 أعضاء", "10 أعضاء", "11 عضواً", "99 عضواً"]);
    expect([1, 2, 5, 13].map((n) => arN(n, W.task))).toEqual(["مهمة واحدة", "مهمتان", "5 مهام", "13 مهمة"]);
  });

  it("only the last two digits decide; 0, 100, 101 take the singular without its tanween", () => {
    expect([0, 100, 101, 103, 111, 1000].map((n) => arN(n, W.day))).toEqual(["0 يوم", "100 يوم", "101 يوم", "103 أيام", "111 يوماً", "1,000 يوم"]);
  });

  it("after a preposition the dual and the sound plural take ين", () => {
    expect(arN(2, G.task)).toBe("مهمتين");
    expect(arN(2, G.otherPerson)).toBe("شخصين آخرين");
    expect(arN(4, G.otherPerson)).toBe("4 أشخاص آخرين");
    expect(arN(4, W.otherPerson)).toBe("4 أشخاص آخرون");
    expect(arN(3, G.task)).toBe("3 مهام");
  });

  it("English: one or many", () => {
    expect([1, 2].map((n) => enN(n, W.member))).toEqual(["1 person", "2 people"]);
  });
});
