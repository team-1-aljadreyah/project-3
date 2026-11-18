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
  await expect(sent.getByRole("link", { name: /علي حسين: نقطة الاتصال جاهزة/ })).toBeVisible();
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
