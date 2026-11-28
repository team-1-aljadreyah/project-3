// Naming what is pasted into a chat message.
import { describe, expect, it } from "vitest";
import { pastedName, pasteIsFiles } from "@/shared/lib/clipboard";

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

describe("a paste that is about its files", () => {
  const gif = [{ name: "DespicableMeMinionsGIF.gif" }];
  it("no text, or text that only names the files (Windows' GIF panel, the file explorer)", () => {
    expect(pasteIsFiles("", gif)).toBe(true);
    expect(pasteIsFiles(String.raw`C:\Users\me\Downloads\InputApp\DespicableMeMinionsGIF.gif`, gif)).toBe(true);
    expect(pasteIsFiles("file:///C:/Users/me/Downloads/Despicable%20Me.gif", [{ name: "Despicable Me.gif" }])).toBe(true);
    expect(pasteIsFiles('"DespicableMeMinionsGIF.gif"', gif)).toBe(true);
    expect(pasteIsFiles("https://media.example.com/clap.gif", [{ name: "image.gif" }])).toBe(true);
  });
  it("real text stays text, and no files means text", () => {
    expect(pasteIsFiles("الاجتماع غداً الساعة العاشرة", [{ name: "image.png" }])).toBe(false);
    expect(pasteIsFiles("100% done", [{ name: "image.png" }])).toBe(false);
    expect(pasteIsFiles("", [])).toBe(false);
  });
});
