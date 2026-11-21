// Reading the id from the address, the same on a Node server and as plain files (Cloudflare Pages).
import { describe, expect, it } from "vitest";
import { paramAfter } from "@/shared/lib/route-param";
import { SHELL_ID, shellParams } from "@/shared/lib/route-shell";

describe("the id in the address", () => {
  it("is the part right after the given one, under deeper pages too", () => {
    expect(paramAfter("/projects/5", "projects")).toBe("5");
    expect(paramAfter("/projects/5/settings", "projects")).toBe("5");
    expect(paramAfter("/tasks/12/", "tasks")).toBe("12");
    expect(paramAfter("/chat/p-3", "chat")).toBe("p-3");
  });

  it("is missing when the address has no such part, or only the shell id", () => {
    expect(paramAfter("/chat", "chat")).toBeUndefined();
    expect(paramAfter("/dashboard", "projects")).toBeUndefined();
    expect(paramAfter(`/projects/${SHELL_ID}`, "projects")).toBeUndefined();
  });

  it("reads encoded parts", () => {
    expect(paramAfter("/chat/d-%D8%A3", "chat")).toBe("d-أ");
  });

  it("each page with an id is built once, for the shell id", () => {
    expect(shellParams("id")).toEqual([{ id: "_" }]);
    expect(shellParams("key")).toEqual([{ key: "_" }]);
  });
});
