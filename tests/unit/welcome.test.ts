// The welcome splash's words: the greeting by the hour, and the first name.
import { describe, expect, it } from "vitest";
import { firstName, greeting } from "@/shared/shell/welcome-splash";

describe("the welcome splash", () => {
  it("says good morning until noon, good evening after", () => {
    expect(greeting(8).ar).toBe("صباح الخير");
    expect(greeting(11).en).toBe("Good morning");
    expect(greeting(12).ar).toBe("مساء الخير");
    expect(greeting(23).en).toBe("Good evening");
    expect(greeting(3).en).toBe("Good evening");
  });

  it("greets by the first name", () => {
    expect(firstName("مريم العبيدي")).toBe("مريم");
    expect(firstName("  Huda Nasser ")).toBe("Huda");
  });
});
