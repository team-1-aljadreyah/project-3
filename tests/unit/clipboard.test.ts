// Naming what is pasted into a chat message.
import { describe, expect, it } from "vitest";
import { pastedName } from "@/shared/lib/clipboard";

describe("pasted files", () => {
  const at = new Date(2026, 10, 28, 14, 30, 5);
  it("a screenshot or a picture copied from a page gets a name with the time", () => {
    expect(pastedName({ name: "image.png", type: "image/png" }, at)).toBe("pasted-20261128-143005.png");
    expect(pastedName({ name: "", type: "image/gif" }, at)).toBe("pasted-20261128-143005.gif");
    expect(pastedName({ name: "image.jpeg", type: "image/jpeg" }, at)).toBe("pasted-20261128-143005.jpg");
  });
  it("a file copied in the file explorer keeps its own name", () => {
    expect(pastedName({ name: "خطة العمل.pdf", type: "application/pdf" }, at)).toBe("خطة العمل.pdf");
    expect(pastedName({ name: "logo.png", type: "image/png" }, at)).toBe("logo.png");
  });
});
