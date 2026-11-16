import { describe, expect, it } from "vitest";
import { cleanApiUrl } from "@/lib/config";
import { arDays, makeFmt } from "@/lib/format";
import { safeNext } from "@/lib/safe-next";
import { daysBetween, matches, today } from "@/lib/utils";

describe("cleanApiUrl", () => {
  it("cuts a trailing slash and /api/v1 (axios adds /api/v1 itself)", () => {
    expect(cleanApiUrl("https://api.example.com/")).toBe("https://api.example.com");
    expect(cleanApiUrl("https://api.example.com/api/v1")).toBe("https://api.example.com");
    expect(cleanApiUrl(" https://api.example.com/api/v1/ ")).toBe("https://api.example.com");
  });

  it("falls back to the local backend when nothing is set", () => {
    expect(cleanApiUrl(undefined)).toBe("http://localhost:8000");
  });
});

describe("safeNext (where to go after signing in)", () => {
  it("accepts a path on this site", () => {
    expect(safeNext("/projects/1")).toBe("/projects/1");
  });

  it("refuses other sites and odd values, and goes home instead", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "", null, "/login"]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});

describe("format", () => {
  it("counts days in Arabic correctly", () => {
    expect(arDays(1)).toBe("يوم واحد");
    expect(arDays(2)).toBe("يومين");
    expect(arDays(5)).toBe("5 أيام");
    expect(arDays(11)).toBe("11 يوماً");
  });

  it("says how far a due day is, in both languages", () => {
    const ar = makeFmt("ar");
    const en = makeFmt("en");
    expect(ar.due(0)).toBe("اليوم");
    expect(ar.due(-2)).toBe("متأخرة يومين");
    expect(en.due(-1)).toBe("1 day late");
    expect(en.due(3)).toBe("in 3 days");
  });

  it("shows percentages and Latin digits", () => {
    const ar = makeFmt("ar");
    expect(ar.pct(0.6449)).toBe("64%");
    expect(ar.num(1250)).toBe("1,250");
  });
});

describe("dates and search", () => {
  it("counts whole days between two days", () => {
    expect(daysBetween("2026-11-16", "2026-11-21")).toBe(5);
    expect(daysBetween("2026-11-16", "2026-11-14")).toBe(-2);
  });

  it("gives a day as YYYY-MM-DD", () => {
    expect(today(1, new Date(2026, 10, 30))).toBe("2026-12-01");
  });

  it("finds Arabic text whatever the letter forms", () => {
    expect(matches("اعلان", "صفحة إعلانات الشركة")).toBe(true);
    expect(matches("مهمه", "مهمة جديدة")).toBe(true);
    expect(matches("تقرير", "صفحة إعلانات الشركة")).toBe(false);
  });
});
