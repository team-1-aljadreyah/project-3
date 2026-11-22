import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

// A fake microphone for this file only: Chrome makes up a beep instead of a real microphone and says yes to the question.
test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  permissions: ["microphone"],
});

async function signOut(page: Page) {
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
}

/** Sara opens her private chat with Ahmed (d-1). */
async function openChatWithAhmed(page: Page) {
  await signInAs(page, /سارة علي/);
  await page.goto("/chat/d-1");
  await expect(page.getByLabel("اكتب رسالة")).toBeVisible();
}

test("Sara records a voice message, hears it, sends it; Ahmed sees its length and plays it", async ({ page }) => {
  await openChatWithAhmed(page);
  // The microphone shows while the box is empty; typing turns it into Send.
  const mic = page.getByRole("button", { name: "سجّل رسالة صوتية" });
  await expect(mic).toBeVisible();
  await page.getByLabel("اكتب رسالة").fill("مرحباً");
  await expect(mic).toHaveCount(0);
  await page.getByLabel("اكتب رسالة").fill("");

  await mic.click();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText(/0:0[1-9]/);
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "أوقف التسجيل" }).click();

  // The preview: hear it, then send it.
  const preview = page.getByRole("group", { name: /^رسالة صوتية/ });
  await expect(preview).toBeVisible();
  await expect(preview.getByText(/^0:0[1-4]$/)).toBeVisible();
  const send = page.getByRole("button", { name: "أرسل الرسالة الصوتية" });
  await expect(send).toBeFocused();
  await preview.getByRole("button", { name: /^شغّل الرسالة الصوتية/ }).click();
  // "Played", not "playing now": a 2-second recording may have ended before the first look on a busy machine.
  await expect.poll(() => preview.locator("audio").evaluate((a: HTMLAudioElement) => !a.paused || a.played.length > 0)).toBe(true);
  await send.click();

  const messages = page.getByRole("list", { name: "الرسائل" });
  const bubble = messages.getByRole("listitem").last().getByRole("group", { name: /^رسالة صوتية/ });
  await expect(bubble).toBeVisible();
  await expect(page.getByLabel("اكتب رسالة")).toBeVisible();
  await signOut(page);

  await signInAs(page, /أحمد كريم/);
  await page.goto("/chat/d-1");
  const received = page.getByRole("list", { name: "الرسائل" }).getByRole("listitem").last().getByRole("group", { name: /^رسالة صوتية/ });
  await expect(received).toBeVisible();
  await expect(received.getByText(/^0:0[1-4]$/)).toBeVisible();
  await expect(received.getByText("لم تستمع إليها بعد")).toBeAttached();
  // Nothing is downloaded before playing.
  await expect(received.locator("audio")).toHaveAttribute("preload", "none");
  await received.getByRole("button", { name: /^شغّل الرسالة الصوتية/ }).click();
  await expect.poll(() => received.locator("audio").evaluate((a: HTMLAudioElement) => !a.paused || a.played.length > 0)).toBe(true);
  await expect(received.getByText("لم تستمع إليها بعد")).toHaveCount(0);
  // The speed goes 1× → 1.5×, and the audio follows.
  await received.getByRole("button", { name: /سرعة التشغيل 1×/ }).click();
  await expect.poll(() => received.locator("audio").evaluate((a: HTMLAudioElement) => a.playbackRate)).toBe(1.5);
  // The small menu downloads the recording.
  await received.getByRole("button", { name: "خيارات الرسالة الصوتية" }).click();
  await expect(page.getByRole("menuitem", { name: /تنزيل التسجيل/ })).toHaveAttribute("download", /^voice-.*\.webm$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: /تنزيل التسجيل/ })).toHaveCount(0);
  // The chat list sums it up as a voice message.
  await page.goto("/chat");
  await expect(page.getByRole("navigation", { name: "قائمة المحادثات" }).locator('a[href="/chat/d-1"]')).toContainText(/رسالة صوتية \(0:0\d\)/);
});

test("hold to talk: letting go shows the preview, and deleting it sends nothing", async ({ page }) => {
  await openChatWithAhmed(page);
  const items = page.getByRole("list", { name: "الرسائل" }).getByRole("listitem");
  await expect(items.first()).toBeVisible();
  const count = await items.count();
  const mic = page.getByRole("button", { name: "سجّل رسالة صوتية" });
  const box = (await mic.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByText("اسحب للإلغاء")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "أرسل الرسالة الصوتية" })).toBeVisible();
  await page.getByRole("button", { name: "احذف التسجيل" }).click();
  await expect(page.getByLabel("اكتب رسالة")).toBeFocused();
  await expect(items).toHaveCount(count);
});

test("the keyboard: Enter starts and stops recording, and Cancel throws it away", async ({ page }) => {
  await openChatWithAhmed(page);
  await page.getByRole("button", { name: "سجّل رسالة صوتية" }).focus();
  await page.keyboard.press("Enter");
  const stop = page.getByRole("button", { name: "أوقف التسجيل" });
  await expect(stop).toBeFocused();
  await page.getByRole("button", { name: "ألغِ التسجيل" }).click();
  await expect(page.getByLabel("اكتب رسالة")).toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(0);
});

test("the microphone refused or missing: a clear message with how to fix it", async ({ page }) => {
  // The browser's answer is made up here: "no" the first time, then "no microphone".
  await page.addInitScript(() => {
    let calls = 0;
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("denied", calls++ === 0 ? "NotAllowedError" : "NotFoundError"));
  });
  await openChatWithAhmed(page);
  // The chat's own alert (Next.js has an empty one for page changes too).
  const alert = page.getByRole("alert").filter({ hasText: /./ });
  await page.getByRole("button", { name: "سجّل رسالة صوتية" }).click();
  await expect(alert).toContainText("لم يُسمح للموقع باستخدام الميكروفون");
  await expect(alert).toContainText("رمز القفل");
  await page.getByRole("button", { name: "سجّل رسالة صوتية" }).click();
  await expect(alert).toContainText("لا يوجد ميكروفون في هذا الجهاز");
  await expect(page.getByRole("timer")).toHaveCount(0);
});
