import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

const column = (page: Page, name: string) => page.getByRole("region", { name: `عمود ${name}` });
const card = (page: Page, code: string) => page.getByRole("link", { name: new RegExp(code) });

/** Drags a card to a column with the mouse, in small steps (a real drag, not a jump). */
async function drag(page: Page, code: string, to: string) {
  await column(page, to).scrollIntoViewIfNeeded();
  await expect(card(page, code)).toBeInViewport();
  const from = await card(page, code).boundingBox();
  const target = await column(page, to).boundingBox();
  if (!from || !target) throw new Error("not on screen");
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + 30, { steps: 3 });
  await page.mouse.move(target.x + target.width / 2, target.y + 80, { steps: 12 });
  await page.mouse.up();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
}

test.describe("on a computer", () => {
  test.skip(({ isMobile }) => isMobile, "dragging with the mouse is a computer test");

  test("the PM drags a card to another column", async ({ page }) => {
    await signInAs(page, /أحمد كريم/);
    await page.goto("/projects/1");
    await drag(page, "TSK-118", "قيد التنفيذ");
    await expect(page.getByText("نُقلت TSK-118 إلى «قيد التنفيذ».")).toBeVisible();
    await expect(column(page, "قيد التنفيذ").getByRole("link", { name: /TSK-118/ })).toBeVisible();
  });

  test("dropping on 'blocked' asks why, and the card shows the reason", async ({ page }) => {
    await signInAs(page, /أحمد كريم/);
    await page.goto("/projects/1");
    // TSK-092 ("testing") is two columns from "blocked", so both are on screen together on any computer width.
    await drag(page, "TSK-092", "متوقفة");
    const dialog = page.getByRole("dialog", { name: /إيقاف TSK-092/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "أوقف المهمة" }).click();
    await expect(dialog.getByText("اكتب السبب أولاً.")).toBeVisible();
    await dialog.getByLabel("لماذا توقفت المهمة؟").fill("بانتظار تصميم الواجهة");
    await dialog.getByRole("button", { name: "أوقف المهمة" }).click();
    await expect(dialog).toBeHidden();
    await expect(column(page, "متوقفة").getByText("بانتظار تصميم الواجهة")).toBeVisible();
  });

  test("a card moves with the keyboard: Space, an arrow, Space", async ({ page }) => {
    await signInAs(page, /أحمد كريم/);
    await page.goto("/projects/1");
    // Each step waits for what a screen reader hears, so the test also checks those announcements.
    const heard = page.locator('[id^="DndLiveRegion"]');
    await card(page, "TSK-118").focus();
    await page.keyboard.press("Space");
    // "Picked up", then at once "over its own column" (the second message replaces the first).
    await expect(heard).toContainText(/بدأ سحب TSK-118|فوق عمود جديدة/);
    // Right to left: the next column ("قيد الانتظار") is on the left.
    // dnd-kit starts listening for the arrows a moment after the pick-up (a setTimeout in its KeyboardSensor), so a
    // robot-fast press can be missed. Press again until it is heard, but never again once it was.
    await expect(async () => {
      if (!(await heard.textContent())?.includes("فوق عمود قيد الانتظار")) await page.keyboard.press("ArrowLeft");
      await expect(heard).toContainText("فوق عمود قيد الانتظار", { timeout: 300 });
    }).toPass({ timeout: 5000 });
    await page.keyboard.press("Space");
    await expect(heard).toContainText("أُفلتت TSK-118 في عمود قيد الانتظار");
    await expect(column(page, "قيد الانتظار").getByRole("link", { name: /TSK-118/ })).toBeVisible();
  });
});

test("the PM adds a task, and it opens from its card", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/1");
  await page.getByRole("button", { name: "مهمة جديدة" }).click();
  const dialog = page.getByRole("dialog", { name: "مهمة جديدة" });
  await dialog.getByRole("button", { name: "أضف المهمة" }).click();
  await expect(dialog.getByText("اكتب عنوان المهمة.")).toBeVisible();
  await dialog.getByLabel("العنوان").fill("صفحة إعدادات الإشعارات");
  await dialog.getByLabel("المسؤول عنها").selectOption({ label: "سارة علي" });
  await dialog.getByRole("button", { name: "أضف المهمة" }).click();
  await expect(dialog).toBeHidden();

  await column(page, "جديدة").getByRole("link", { name: /صفحة إعدادات الإشعارات/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "صفحة إعدادات الإشعارات" })).toBeVisible();
  await page.getByRole("tab", { name: "سجل التحديثات" }).click();
  await expect(page.getByText("أنشأ المهمة")).toBeVisible();
});

test("an employee asks to approve 'done'; the PM approves", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/projects/1");
  await expect(page.getByRole("button", { name: "مهمة جديدة" })).toHaveCount(0);
  // TSK-109 is Sara's own task.
  await card(page, "TSK-109").click();
  await expect(page.getByRole("heading", { level: 1, name: "صفحة إعلانات الشركة" })).toBeVisible();
  await expect(page.getByRole("button", { name: "تعديل" })).toHaveCount(0);
  await page.getByLabel("الحالة").selectOption({ label: "مكتملة" });
  await expect(page.getByText("أُرسل طلب اعتماد الإكمال إلى مدير المشروع.")).toBeVisible();
  await expect(page.getByText(/بانتظار اعتماد الإكمال:/)).toBeVisible();
  const url = page.url();

  await signOut(page);
  await signInAs(page, /أحمد كريم/);
  await page.goto(url);
  await page.getByRole("button", { name: "اعتمد الإكمال" }).click();
  await expect(page.getByText("اعتُمد إكمال المهمة.")).toBeVisible();
  await expect(page.getByLabel("الحالة")).toHaveValue("completed");
});

test("the PM sends a completion back with a note", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/1");
  await card(page, "TSK-099").click();
  await page.getByRole("button", { name: "أرجعها مع ملاحظة" }).click();
  const dialog = page.getByRole("dialog", { name: /إرجاع TSK-099/ });
  await dialog.getByLabel("ما الذي يحتاج إلى إصلاح؟").fill("أضف اختباراً للتنبيه المتأخر");
  await dialog.getByRole("button", { name: "أرجعها" }).click();
  await expect(page.getByText(/أُرجعت المهمة:/)).toBeVisible();
  await expect(page.getByText("«أضف اختباراً للتنبيه المتأخر»").first()).toBeVisible();
  await expect(page.getByLabel("الحالة")).toHaveValue("in_review");
});

test("comments are added, and the history says who did what", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/1");
  await card(page, "TSK-097").click();
  await expect(page.getByText("سبب التوقف:")).toBeVisible();
  await page.getByLabel("أضف تعليقاً").fill("حصلنا على الصلاحية، أكمل العمل.");
  await page.getByRole("button", { name: "أرسل التعليق" }).click();
  await expect(page.getByRole("tabpanel").getByText("حصلنا على الصلاحية، أكمل العمل.")).toBeVisible();
  await page.getByRole("tab", { name: "سجل التحديثات" }).click();
  await expect(page.getByRole("tabpanel").getByText("أضاف تعليقاً")).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("أوقفها")).toBeVisible();
});

test("the PM changes the due date with a reason; it shows in the history", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/1");
  await card(page, "TSK-118").click();
  await page.getByRole("button", { name: "تعديل" }).click();
  const dialog = page.getByRole("dialog", { name: /تعديل TSK-118/ });
  await dialog.getByLabel("موعد التسليم").fill("2027-01-10");
  await dialog.getByLabel(/سبب تغيير موعد التسليم/).fill("أُضيف تقرير الفرق");
  await dialog.getByRole("button", { name: "احفظ" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("tab", { name: "سجل التحديثات" }).click();
  await expect(page.getByRole("tabpanel").getByText(/غيّر موعد التسليم/)).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("«أُضيف تقرير الفرق»")).toBeVisible();
});
