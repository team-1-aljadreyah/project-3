import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

// Alerts while the platform is open (a chime and a system notification), and the unread-chat reminders in the bell.

const SARA = 5;
const AHMED = 2;

interface Shown {
  title: string;
  body?: string;
  tag?: string;
  url?: string;
}

/**
 * Records the system notifications and counts the chime's notes instead of showing and playing them: both ways of
 * showing one (the service worker's, and `new Notification`), and the Web Audio oscillators the chime is made of.
 */
async function recordAlerts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { shown: Shown[]; notes: number };
    w.shown = [];
    w.notes = 0;
    const record = (title: string, options?: NotificationOptions) =>
      w.shown.push({ title, body: options?.body, tag: options?.tag, url: (options?.data as { url?: string } | undefined)?.url });
    ServiceWorkerRegistration.prototype.showNotification = async function (title: string, options?: NotificationOptions) {
      record(title, options);
    };
    const Real = window.Notification;
    class Recorded {
      static get permission() {
        return Real.permission;
      }
      static requestPermission = () => Real.requestPermission();
      onclick: unknown = null;
      constructor(title: string, options?: NotificationOptions) {
        record(title, options);
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", { value: Recorded, configurable: true, writable: true });
    const RealAudio = window.AudioContext;
    window.AudioContext = class extends RealAudio {
      createOscillator() {
        w.notes++;
        return super.createOscillator();
      }
    };
  });
}

/**
 * Something happens on "the server" (the demo database in this browser) while Sara's page is open: another tab of the
 * same browser changes the data and tells the open tabs, like any change from another tab does.
 */
async function serverChange(context: BrowserContext, change: string, arg: object) {
  const other = await context.newPage();
  await other.goto("/offline.html");
  await other.evaluate(
    ([change, arg]) => {
      const saved = JSON.parse(localStorage.getItem("p3.mock.db")!);
      const db = saved.db;
      const now = new Date().toISOString();
      const a = arg as { author: number; chat: string; body: string; to: number; code: string };
      if (change === "message") db.messages.push({ id: ++db.seq.message, chat: a.chat, author_id: a.author, body: a.body, mentions: [], created_at: now });
      if (change === "notification")
        db.notifications.push({ id: ++db.seq.notification, user_id: a.to, kind: "task_assigned", actor_id: a.author, data: { task_code: a.code }, at: now, read: false });
      localStorage.setItem("p3.mock.db", JSON.stringify(saved));
      new BroadcastChannel("p3-live").postMessage("changed");
    },
    [change, arg] as const,
  );
  await other.close();
}

const shown = (page: Page) => page.evaluate(() => (window as unknown as { shown: Shown[] }).shown);
const notes = (page: Page) => page.evaluate(() => (window as unknown as { notes: number }).notes);

test("a new message from someone else rings and shows a notification; Sara's own message doesn't", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await recordAlerts(page);
  await signInAs(page, /سارة علي/);
  // Opening the app alerts for nothing, even with unread messages and notifications waiting.
  await page.waitForTimeout(800);
  expect(await shown(page)).toEqual([]);

  // Sara writes from another tab: nothing.
  await serverChange(context, "message", { author: SARA, chat: "p-1", body: "رسالتي أنا" });
  // Ahmed writes to her: a chime and a notification with his name and the text, which opens the chat.
  await serverChange(context, "message", { author: AHMED, chat: "d-1", body: "سارة، راجعي صفحة الإعلانات من فضلك" });
  await expect.poll(() => shown(page)).toContainEqual({ title: "أحمد كريم (2)", body: "سارة، راجعي صفحة الإعلانات من فضلك", tag: "chat-d-1", url: "/chat/d-1" });
  expect(await notes(page)).toBeGreaterThan(0);
  expect((await shown(page)).some((n) => n.body?.includes("رسالتي أنا"))).toBe(false);

  // A notification for her: the notification's own sentence.
  await serverChange(context, "notification", { author: AHMED, to: SARA, code: "TSK-777" });
  await expect.poll(() => shown(page)).toContainEqual(expect.objectContaining({ title: "أحمد كريم", body: "أحمد كريم أسند إليك TSK-777" }));
  expect((await shown(page)).filter((n) => n.tag === "chat-d-1")).toHaveLength(1);
});

test("no notification for the chat Sara is reading", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await recordAlerts(page);
  await signInAs(page, /سارة علي/);
  await page.goto("/chat/d-1");
  await expect(page.getByRole("list", { name: "الرسائل" })).toBeVisible();
  await serverChange(context, "message", { author: AHMED, chat: "d-1", body: "هل وصلتك؟" });
  await expect(page.getByRole("list", { name: "الرسائل" }).getByText("هل وصلتك؟")).toBeVisible();
  // A message in another chat still alerts (so the watcher did look).
  await serverChange(context, "message", { author: AHMED, chat: "p-1", body: "اجتماع بعد ساعة" });
  await expect.poll(() => shown(page)).toContainEqual(expect.objectContaining({ tag: "chat-p-1" }));
  expect((await shown(page)).some((n) => n.tag === "chat-d-1")).toBe(false);
});

test("Sara sees a reminder for the chat she hasn't opened; opening the chat removes it", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/chat/d-1");
  const box = page.getByLabel("اكتب رسالة");
  await box.fill("أرسلت لك ملفات التصميم");
  await box.press("Enter");
  await expect(page.getByRole("list", { name: "الرسائل" }).getByText("أرسلت لك ملفات التصميم")).toBeVisible();
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();

  await signInAs(page, /سارة علي/);
  await page.getByRole("button", { name: /^الإشعارات/ }).click();
  const panel = page.getByRole("dialog", { name: "آخر الإشعارات" });
  await expect(panel.getByRole("heading", { name: "رسائل لم تقرأها" })).toBeVisible();
  const reminder = panel.getByRole("link", { name: /رسالتان لم تقرأهما من أحمد كريم/ });
  await expect(reminder).toContainText("أرسلت لك ملفات التصميم");
  await reminder.click();
  await expect(page).toHaveURL(/\/chat\/d-1$/);
  await expect(page.getByRole("list", { name: "الرسائل" }).getByText("أرسلت لك ملفات التصميم")).toBeVisible();

  await page.getByRole("button", { name: /^الإشعارات/ }).click();
  await expect(panel.getByRole("link", { name: /في محادثة «منصة الحجز الإلكتروني»/ })).toBeVisible();
  await expect(panel.getByRole("link", { name: /من أحمد كريم/ })).toHaveCount(0);
});

test("the notifications page sets this device's alerts, kept after a reload", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/notifications");
  const sound = page.getByRole("switch", { name: /^الصوت/ });
  await expect(sound).toBeChecked();
  await sound.uncheck();
  await expect(page.getByRole("switch", { name: /نغمة الرسائل/ })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("switch", { name: /^الصوت/ })).not.toBeChecked();
  // The demo says that alerts need the platform open.
  await expect(page.getByText(/لا يوجد خادم إشعارات/)).toBeVisible();
});

test("after sign-in a card invites to turn alerts on; a blocked browser gets the way to unblock instead", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  const invite = page.getByRole("complementary", { name: "التنبيهات" });
  await expect(invite).toContainText("فعّل التنبيهات لتصلك الرسائل والإشعارات حتى والمنصة في الخلفية");
  await invite.getByRole("button", { name: "لاحقاً" }).click();
  await expect(invite).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "المشاريع" })).toBeVisible();
  await expect(invite).toHaveCount(0);
});

test.describe("notifications blocked in the browser", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "denied" }));
  });

  test("no invitation card, and the settings say how to unblock", async ({ page }) => {
    await signInAs(page, /سارة علي/);
    await page.goto("/notifications");
    await expect(page.getByRole("switch", { name: /إشعارات النظام/ })).toBeDisabled();
    await expect(page.getByText(/حجبتها في هذا المتصفح/)).toBeVisible();
    await expect(page.getByRole("complementary", { name: "التنبيهات" })).toHaveCount(0);
  });
});

test("anyone turns notifications off and on from the account menu; the notifications page shows the same", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.getByRole("button", { name: /حسابي/ }).click();
  const group = page.getByRole("group", { name: "التنبيهات" });
  await expect(group.getByRole("menuitemradio", { name: "تشغيل" })).toHaveAttribute("aria-checked", "true");
  await group.getByRole("menuitemradio", { name: "إيقاف" }).click();
  await expect(group.getByRole("menuitemradio", { name: "إيقاف" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await page.goto("/notifications");
  await expect(page.getByRole("switch", { name: /التنبيهات على هذا الجهاز/ })).not.toBeChecked();
  // On again, from the menu.
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("group", { name: "التنبيهات" }).getByRole("menuitemradio", { name: "تشغيل" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("switch", { name: /التنبيهات على هذا الجهاز/ })).toBeChecked();
});
