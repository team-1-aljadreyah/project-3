import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

// The audit log's detail panel: pressing a line tells everything about it (who, from where, what changed), ↓ steps to
// the next line, the subject's history is one tab away, Escape and Back close it, and `?entry=` opens it again.

test("the CEO opens a line: who, IP, device and changes; ↓ steps on; the subject's history; Escape closes; the address reopens it", async ({ page }) => {
  test.setTimeout(60_000);
  // One wrong password first, so a failed sign-in is in the log.
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("employee@demo.test");
  await page.getByLabel("كلمة المرور").fill("wrong-password");
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page.getByText("البريد أو كلمة المرور غير صحيحة.")).toBeVisible();

  await signInAs(page, /مريم العبيدي/);
  await page.goto("/audit");
  const log = page.getByRole("list", { name: "العمليات" });
  // The failed sign-in is marked.
  await expect(log.getByRole("listitem").first()).toContainText("محاولة دخول خاطئة");
  await expect(log.getByRole("listitem").first().getByText("فشل")).toBeVisible();

  // Press the CEO's change of the review criteria.
  await log.getByRole("listitem").filter({ hasText: "غيّر معايير التقييم" }).getByRole("button").click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { level: 2 })).toContainText("مريم العبيدي");
  await expect(panel.getByRole("heading", { level: 2 })).toContainText("غيّر معايير التقييم");
  await expect(panel.getByText("ceo@demo.test")).toBeVisible();
  await expect(panel.getByText("198.51.100.24")).toBeVisible();
  await expect(panel.getByText(/^Safari 18\.1 على (macOS|iOS)/)).toBeVisible();
  const changes = panel.getByRole("table", { name: /ما تغيّر/ });
  await expect(changes.getByRole("rowheader", { name: "المعايير وأوزانها" })).toBeVisible();
  await expect(changes).toContainText("جودة العمل 30");
  await expect(changes).toContainText("جودة العمل 20");
  await expect(page).toHaveURL(/[?&]entry=\d+/);
  const criteriaUrl = page.url();

  // ↓: the next (older) line, the PM's new project, from his own address on Edge.
  await page.keyboard.press("ArrowDown");
  await expect(panel.getByRole("heading", { level: 2 })).toContainText("أحمد كريم أنشأ مشروعاً");
  await expect(panel.getByText("198.51.100.31")).toBeVisible();
  await expect(panel.getByText(/^Edge 130 على Windows/)).toBeVisible();
  expect(page.url()).not.toBe(criteriaUrl);
  // ↓ again: the admin's settings change, from the office network on Firefox.
  await page.keyboard.press("ArrowDown");
  await expect(panel.getByRole("heading", { level: 2 })).toContainText("حسن رعد");
  await expect(panel.getByRole("heading", { level: 2 })).toContainText("غيّر الإعدادات");
  await expect(panel.getByText("10.20.0.5")).toBeVisible();
  await expect(panel.getByText(/^Firefox 132 على Ubuntu/)).toBeVisible();
  await expect(changes.getByRole("rowheader", { name: /قريب الموعد/ })).toBeVisible();

  // The history of this subject: the other settings changes; one press switches the panel to it.
  await panel.getByRole("tab", { name: /سجل هذا العنصر/ }).click();
  const history = panel.getByRole("tabpanel");
  await expect(history.getByRole("button")).toHaveCount(2);
  await history.getByRole("button").last().click();
  await expect(panel.getByRole("rowheader", { name: "محاولات خاطئة قبل القفل" })).toBeVisible();

  // Escape closes it, and the address forgets it.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page).not.toHaveURL(/entry=/);

  // A shared address opens it again.
  await page.goto(criteriaUrl);
  await expect(page.getByRole("dialog").getByRole("heading", { level: 2 })).toContainText("غيّر معايير التقييم");
  await page.getByRole("dialog").getByRole("button", { name: "إغلاق" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("Back closes the panel; the subject link in a line opens the subject, not the panel; the IP filter stays in the address", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/audit");
  const log = page.getByRole("list", { name: "العمليات" });

  await log.getByRole("listitem").filter({ hasText: "أنشأ مشروعاً" }).first().getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/audit$/);

  // Only the admin's lines from the office network.
  await page.getByLabel(/عنوان IP/).fill("10.20.0.");
  await page.getByLabel(/عنوان IP/).press("Enter");
  await expect(page).toHaveURL(/ip=10\.20\.0\./);
  await expect(log.getByRole("listitem").first()).toContainText("حسن رعد");
  await expect(log.getByRole("listitem").filter({ hasNotText: "حسن رعد" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel(/عنوان IP/)).toHaveValue("10.20.0.");
  await expect(log.getByRole("listitem").filter({ hasNotText: "حسن رعد" })).toHaveCount(0);

  // The subject's own link still opens the subject.
  await page.goto("/audit?kind=project");
  await log.getByRole("link", { name: "حملة التسويق الشتوية" }).click();
  await expect(page).toHaveURL(/\/projects\/3/);
});
