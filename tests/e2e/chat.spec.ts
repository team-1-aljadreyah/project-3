import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

async function signOut(page: Page) {
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
}

const chatList = (page: Page) => page.getByRole("navigation", { name: "قائمة المحادثات" });

test("Ahmed answers a message and mentions Sara; Sara is notified and the link opens the chat", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "المحادثات" }).click();
  await chatList(page).getByRole("link", { name: /منصة الحجز الإلكتروني/ }).click();
  await expect(page).toHaveURL(/\/chat\/p-1$/);

  const messages = page.getByRole("list", { name: "الرسائل" });
  await messages.getByRole("button", { name: "ردّ على رسالة علي حسين" }).click();
  await expect(page.getByText(/ردّ على علي حسين/)).toBeVisible();

  const box = page.getByLabel("اكتب رسالة");
  await box.fill("شكراً. ");
  await box.pressSequentially("@سا");
  await page.getByRole("listbox", { name: "اختر من تذكره" }).getByRole("button", { name: /سارة علي/ }).click();
  await box.pressSequentially("جرّبيها اليوم من فضلك");
  await box.press("Enter");

  const sent = messages.getByRole("listitem").filter({ hasText: "جرّبيها اليوم من فضلك" });
  await expect(sent).toBeVisible();
  await expect(sent.getByRole("button", { name: /علي حسين: نقطة الاتصال جاهزة/ })).toBeVisible();
  await expect(box).toHaveValue("");
  await signOut(page);

  await signInAs(page, /سارة علي/);
  await page.getByRole("button", { name: /^الإشعارات/ }).click();
  // The newest mention (Sara's demo data has an older one from Ahmed too).
  await page.getByRole("dialog", { name: "آخر الإشعارات" }).getByRole("link", { name: /أحمد كريم ذكرك في محادثة.*جرّبيها اليوم/ }).click();
  await expect(page).toHaveURL(/\/chat\/p-1$/);
  await expect(page.getByRole("list", { name: "الرسائل" }).getByText("جرّبيها اليوم من فضلك")).toBeVisible();
});

test("new messages are counted until the chat is opened", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/chat");
  const row = chatList(page).getByRole("link", { name: /أحمد كريم/ });
  await expect(row.getByText("رسائل جديدة")).toBeAttached();
  await row.click();
  await expect(row.getByText("رسائل جديدة")).toHaveCount(0);
});

test("Sara starts a private chat with Zainab and sends a file", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/chat");
  await page.getByRole("button", { name: "محادثة خاصة جديدة" }).click();
  const dialog = page.getByRole("dialog", { name: "محادثة خاصة جديدة" });
  await dialog.getByLabel("ابحث عن زميل").fill("زينب");
  await dialog.getByRole("button", { name: /زينب فاضل/ }).click();
  await expect(page).toHaveURL(/\/chat\/d-\d+$/);

  // The hidden file picker behind the paperclip (choosing a file in the system window can't be automated).
  await page.locator('input[type="file"]').setInputFiles({ name: "خطة-الاختبار.txt", mimeType: "text/plain", buffer: Buffer.from("خطة") });
  await page.getByLabel("اكتب رسالة").fill("هذه خطة الاختبار");
  await page.getByRole("button", { name: "أرسل" }).click();
  const sent = page.getByRole("list", { name: "الرسائل" }).getByRole("listitem").filter({ hasText: "هذه خطة الاختبار" });
  await expect(sent.getByRole("link", { name: /خطة-الاختبار\.txt/ })).toBeVisible();
  // The new chat is in the list (on a phone the list shows when no chat is open).
  await page.goto("/chat");
  await expect(chatList(page).getByRole("link", { name: /زينب فاضل/ })).toBeVisible();
});

test("Huda (monitoring) makes a group with two people, writes in it, and it shows in the list", async ({ page }) => {
  await signInAs(page, /هدى ناصر/);
  await page.goto("/chat");
  // She follows every project chat too.
  await expect(chatList(page).getByRole("link", { name: /حملة التسويق الشتوية/ })).toBeVisible();
  await page.getByRole("button", { name: "مجموعة جديدة" }).click();
  const dialog = page.getByRole("dialog", { name: "مجموعة جديدة" });
  // Too few people: the form says so and nothing is made.
  await dialog.getByLabel("اسم المجموعة").fill("مراجعة الجودة");
  await dialog.getByRole("button", { name: "أنشئ المجموعة" }).click();
  await expect(dialog.getByText("اختر شخصين آخرين على الأقل.")).toBeVisible();
  await dialog.getByLabel("ابحث عن زميل").fill("زينب");
  await dialog.getByRole("checkbox", { name: /زينب فاضل/ }).check();
  await dialog.getByLabel("ابحث عن زميل").fill("سارة");
  await dialog.getByRole("checkbox", { name: /سارة علي/ }).check();
  await dialog.getByRole("button", { name: "أنشئ المجموعة" }).click();
  await expect(page).toHaveURL(/\/chat\/g-\d+$/);
  await expect(page.getByText(/مجموعة · (٣|3) أعضاء/)).toBeVisible();

  await page.getByLabel("اكتب رسالة").fill("أهلاً بكما، هنا نتابع ملاحظات الجودة.");
  await page.getByRole("button", { name: "أرسل" }).click();
  await expect(page.getByRole("list", { name: "الرسائل" }).getByText("أهلاً بكما، هنا نتابع ملاحظات الجودة.")).toBeVisible();
  // She made it, so she may manage it; and she may leave it.
  await expect(page.getByRole("button", { name: "إدارة المجموعة" })).toBeVisible();
  await expect(page.getByRole("button", { name: "مغادرة المجموعة" })).toBeVisible();
  // The group is in the list with its last message (on a phone the list shows when no chat is open).
  await page.goto("/chat");
  const row = chatList(page).getByRole("link", { name: /مراجعة الجودة/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("أهلاً بكما");
});

test("an employee doesn't see the New group button", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/chat");
  await expect(page.getByRole("button", { name: "محادثة خاصة جديدة" })).toBeVisible();
  await expect(page.getByRole("button", { name: "مجموعة جديدة" })).toHaveCount(0);
});

test("a chat you aren't in isn't shown", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/chat/p-3");
  await expect(page.getByText("لم يُعثر على المحادثة")).toBeVisible();
  await expect(chatList(page).getByRole("link", { name: /حملة التسويق الشتوية/ })).toHaveCount(0);
});

test("on a phone: the list, then the chat with a way back", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await signInAs(page, /سارة علي/);
  await page.goto("/chat");
  await chatList(page).getByRole("link", { name: /فريق التطوير/ }).click();
  await expect(chatList(page)).toBeHidden();
  await expect(page.getByLabel("اكتب رسالة")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
  await page.getByRole("link", { name: "رجوع إلى المحادثات" }).click();
  await expect(chatList(page)).toBeVisible();
});

test("a picture sent in a chat shows as a preview and opens in the viewer, with a download button", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/chat/p-1");
  // A real 1×1 PNG (the server checks the file's first bytes).
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"]').setInputFiles({ name: "لقطة-الشاشة.png", mimeType: "image/png", buffer: png });
  await page.getByLabel("اكتب رسالة").fill("هذه لقطة الشاشة");
  await page.getByRole("button", { name: "أرسل" }).click();
  const sent = page.getByRole("list", { name: "الرسائل" }).getByRole("listitem").filter({ hasText: "هذه لقطة الشاشة" });

  // The picture itself is in the message, and pressing it opens the viewer instead of downloading.
  await sent.getByRole("button", { name: "اعرض الصورة لقطة-الشاشة.png" }).click();
  const viewer = page.getByRole("dialog", { name: "صورة: لقطة-الشاشة.png" });
  await expect(viewer.getByRole("img", { name: "لقطة-الشاشة.png" })).toBeVisible();
  await expect(viewer.getByRole("link", { name: "نزّل الصورة" })).toHaveAttribute("download", "لقطة-الشاشة.png");
  await viewer.getByRole("button", { name: "كبّر" }).click();
  await expect(viewer.getByRole("button", { name: "بحجم الشاشة" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
});

test("two tabs, two people: Ahmed's message appears in Sara's open chat without a refresh", async ({ context }) => {
  test.setTimeout(60_000);
  const ahmed = await context.newPage();
  await signInAs(ahmed, /أحمد كريم/);
  // The demo keeps a session per tab. A new tab opens as Ahmed (the last to sign in); signing out there and in as Sara
  // leaves the first tab as Ahmed.
  const sara = await context.newPage();
  await sara.goto("/chat");
  await sara.getByRole("button", { name: /حسابي: أحمد كريم/ }).click();
  await sara.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await sara.getByRole("button", { name: /سارة علي/ }).click();
  await expect(sara.getByRole("navigation", { name: "القائمة الرئيسية" })).toBeVisible();
  await ahmed.goto("/chat/p-1");
  await expect(ahmed.getByRole("button", { name: /حسابي: أحمد كريم/ })).toBeVisible();
  await sara.goto("/chat/p-1");
  await expect(sara.getByRole("button", { name: /حسابي: سارة علي/ })).toBeVisible();
  const saraMessages = sara.getByRole("list", { name: "الرسائل" });
  await expect(saraMessages).toBeVisible();

  await ahmed.getByLabel("اكتب رسالة").fill("سارة، الاجتماع بعد ربع ساعة");
  await ahmed.getByRole("button", { name: "أرسل" }).click();
  // No reload in Sara's tab.
  await expect(saraMessages.getByText("سارة، الاجتماع بعد ربع ساعة")).toBeVisible();
  // And her reply reaches Ahmed the same way.
  await sara.getByLabel("اكتب رسالة").fill("تمام، أنا جاهزة");
  await sara.getByRole("button", { name: "أرسل" }).click();
  await expect(ahmed.getByRole("list", { name: "الرسائل" }).getByText("تمام، أنا جاهزة")).toBeVisible();
});

/** Adds `n` messages from Ahmed to a chat, straight into this browser's demo data, then reloads. */
async function addMessages(page: import("@playwright/test").Page, chat: string, n: number) {
  await page.evaluate(
    ([chat, n]) => {
      const saved = JSON.parse(localStorage.getItem("p3.mock.db")!);
      const db = saved.db;
      for (let i = 1; i <= n; i++) db.messages.push({ id: ++db.seq.message, chat, author_id: 2, body: `رسالة قديمة ${i}`, mentions: [], created_at: new Date(Date.now() - (n - i) * 60000).toISOString() });
      localStorage.setItem("p3.mock.db", JSON.stringify(saved));
    },
    [chat, n] as const,
  );
  await page.reload();
}

test("a long chat opens with the newest messages; scrolling up loads the older ones; sending never moves the page", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, /سارة علي/);
  await page.goto("/chat/p-1");
  await addMessages(page, "p-1", 45);
  const list = page.getByRole("list", { name: "الرسائل" });
  await expect(list.getByText("رسالة قديمة 45", { exact: true })).toBeVisible();
  // Only the newest 30 at first.
  await expect(list.getByRole("listitem")).toHaveCount(30);
  await expect(list.getByText("رسالة قديمة 10", { exact: true })).toHaveCount(0);

  // To the top of the list: the older ones come in.
  await list.evaluate((ol) => (ol.parentElement!.scrollTop = 0));
  await expect(list.getByText("رسالة قديمة 10", { exact: true })).toBeAttached();
  await expect.poll(() => list.getByRole("listitem").count()).toBeGreaterThan(30);

  // Sending: the list goes to the new message, the page itself stays where it is. (Typing first: the test tool scrolls
  // a box into view before it types in it, so the page is measured just before pressing send.)
  await page.getByLabel("اكتب رسالة").fill("رسالة جديدة في الأسفل");
  const pageTop = await page.evaluate(() => window.scrollY);
  await page.getByLabel("اكتب رسالة").press("Enter");
  await expect(list.getByText("رسالة جديدة في الأسفل")).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(pageTop);
});

test("the chat's name and faces open its details: the way to the project and every member", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/chat/p-1");
  await page.getByRole("button", { name: /معلومات المحادثة وأعضاؤها/ }).click();
  const info = page.getByRole("dialog", { name: "معلومات المحادثة" });
  await expect(info.getByRole("link", { name: /افتح المشروع/ })).toHaveAttribute("href", /\/projects\/1$/);
  await expect(info.getByText("سارة علي")).toBeVisible();
  await expect(info.getByText("(أنت)")).toBeVisible();
  await expect(info.getByText("أحمد كريم")).toBeVisible();
});

// 25 November 2026 (the client: "when I send, show it already sent, without waiting"). The demo server is made slow
// (3 s) so the test can see the page before the answer comes: the message is in the chat and the box is empty at once.
test("a sent message shows at once, before the server answers, and stays when the answer comes", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.evaluate(() => localStorage.setItem("p3.mock.latency", "3000"));
  await page.goto("/chat/p-1");
  const box = page.getByLabel("اكتب رسالة");
  await expect(page.getByRole("list", { name: "الرسائل" })).toBeVisible({ timeout: 15_000 });
  await expect(box).toBeEnabled();
  await box.fill("وصلت فوراً");
  await box.press("Enter");

  const sent = page.getByRole("list", { name: "الرسائل" }).getByRole("listitem").filter({ hasText: "وصلت فوراً" });
  // Well before the server's 3 s: shown, box empty and ready for the next one.
  await expect(sent).toBeVisible({ timeout: 1000 });
  await expect(box).toHaveValue("");
  await expect(box).toBeEnabled();
  // After the answer and the next refresh: still there, once.
  await page.waitForTimeout(4500);
  await expect(sent).toHaveCount(1);
  await expect(sent.getByRole("button", { name: /ردّ على رسالة أحمد كريم/ })).toBeVisible();
});

test("a message that couldn't be sent goes away, and its text comes back in the box with the reason", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/chat/p-1");
  const box = page.getByLabel("اكتب رسالة");
  await expect(box).toBeEnabled();
  await page.evaluate(() => localStorage.setItem("p3.mock.offline", "1"));
  await box.fill("لن تصل");
  await box.press("Enter");

  const messages = page.getByRole("list", { name: "الرسائل" });
  await expect(page.getByText("لا يوجد اتصال بالخادم. تحقّق من اتصالك بالإنترنت.")).toBeVisible();
  await expect(messages.getByText("لن تصل")).toHaveCount(0);
  await expect(box).toHaveValue("لن تصل");

  // Back online: the same text goes, once.
  await page.evaluate(() => localStorage.removeItem("p3.mock.offline"));
  await box.press("Enter");
  await expect(messages.getByRole("listitem").filter({ hasText: "لن تصل" })).toHaveCount(1);
  await expect(box).toHaveValue("");
});
