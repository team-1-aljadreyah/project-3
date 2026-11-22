// The first link seen for a file is kept while it works, so a voice message or a picture doesn't load again every time
// the server signs its link anew (every few seconds in an open chat).
import { describe, expect, it } from "vitest";
import { renewUrl, stableUrl } from "@/shared/lib/stable-url";

describe("stable file links", () => {
  it("keeps the first signed link of a file; a new signature of the same file gets the kept one", () => {
    const a = "https://api.test/api/v1/attachments/7/file?expires=100&signature=aaa";
    const b = "https://api.test/api/v1/attachments/7/file?expires=103&signature=bbb";
    expect(stableUrl(a)).toBe(a);
    expect(stableUrl(b)).toBe(a);
    // Another file has its own.
    const other = "https://api.test/api/v1/attachments/8/file?expires=103&signature=ccc";
    expect(stableUrl(other)).toBe(other);
  });

  it("after the kept one stops working, the fresher link is used and kept", () => {
    const old = "https://api.test/api/v1/attachments/9/file?expires=1&signature=old";
    const fresh = "https://api.test/api/v1/attachments/9/file?expires=9&signature=new";
    stableUrl(old);
    renewUrl(fresh);
    expect(stableUrl(fresh)).toBe(fresh);
    expect(stableUrl("https://api.test/api/v1/attachments/9/file?expires=12&signature=later")).toBe(fresh);
  });

  it("links without a signature, data: and blob: links pass as they are", () => {
    expect(stableUrl("data:audio/webm;base64,AAA?x")).toBe("data:audio/webm;base64,AAA?x");
    expect(stableUrl("https://cdn.test/a.png")).toBe("https://cdn.test/a.png");
    expect(stableUrl(undefined)).toBeUndefined();
  });
});
