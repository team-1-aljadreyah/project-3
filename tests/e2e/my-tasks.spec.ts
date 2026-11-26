import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

// Sara (the demo employee) has two tasks, both in "منصة الحجز الإلكتروني": TSK-118 (new, due in 4 days) and TSK-109
// (in progress, two days late). The summary at the top of "My tasks" counts them; the list under it stays as it was.

const tiles = (page: Page, name = "ملخص مهامي") => page.getByRole("region", { name }).getByRole("listitem");
/** How far the page sticks out sideways (0 = it fits the screen). */
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("My tasks opens with the summary: the numbers, the projects, the statuses and how much is done", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/my-tasks");

  // The five tiles. A second line shows only when there is something real to say (nothing is in review).
  await expect(tiles(page)).toHaveCount(5);
  await expect(tiles(page).filter({ hasText: "مهام مفتوحة" })).toHaveText(/^2\s*مهام مفتوحة\s*من أصل 2$/);
  await expect(tiles(page).filter({ hasText: "موعدها اليوم" })).toHaveText(/^0\s*موعدها اليوم\s*خلال 7 أيام: 1$/);
  await expect(tiles(page).filter({ hasText: "متأخرة" })).toHaveText(/^1\s*متأخرة\s*أقدمها متأخرة يومين$/);
  await expect(tiles(page).filter({ hasText: "قيد المراجعة" })).toHaveText(/^0\s*قيد المراجعة$/);
  await expect(tiles(page).filter({ hasText: "مكتملة" })).toHaveText(/^0\s*مكتملة\s*0% من مهامي$/);

  // One pill per project with open tasks, with the count.
  const projects = page.getByRole("region", { name: "مهامي حسب المشروع" });
  await expect(projects.getByRole("link")).toHaveCount(1);
  await expect(projects.getByRole("link", { name: /منصة الحجز الإلكتروني.*مهام مفتوحة:\s*2/ })).toBeVisible();

  // The ring says its numbers in words, and the legend lists them.
  const statuses = page.getByRole("region", { name: "حسب الحالة" });
  await expect(statuses.getByRole("img", { name: "مهامي حسب الحالة: جديدة 1، قيد التنفيذ 1" })).toBeVisible();
  await expect(statuses.getByRole("listitem")).toHaveText([/^جديدة\s*1$/, /^قيد التنفيذ\s*1$/]);

  // The gauge too, with the four small numbers under it.
  const done = page.getByRole("region", { name: "المنجز" });
  await expect(done.getByRole("img", { name: "المنجز: 0 من 2 (0%)" })).toBeVisible();
  await expect(done.locator("dl")).toHaveText(/مكتملة\s*0\/2[\s\S]*مفتوحة\s*2\/2[\s\S]*متأخرة\s*1\/2[\s\S]*مراجعة\s*0\/2/);

  // The list is still under the summary, and the page fits the screen.
  await expect(page.getByText("مهام مفتوحة: 2")).toBeVisible();
  await expect(page.getByRole("region", { name: /متأخرة/ }).getByRole("link", { name: /TSK-109/ })).toBeVisible();
  expect(await sideways(page)).toBe(0);
});

test("a project's pill in the summary opens the project's board", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/my-tasks");
  await page.getByRole("region", { name: "مهامي حسب المشروع" }).getByRole("link", { name: /منصة الحجز الإلكتروني/ }).click();
  await expect(page).toHaveURL(/\/projects\/1$/);
  await expect(page.getByRole("heading", { level: 1, name: /منصة الحجز الإلكتروني/ })).toBeVisible();
});

test("a completion that waits for approval counts as in review, and the task stays open", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/my-tasks");
  const review = tiles(page).filter({ hasText: "قيد المراجعة" });
  await expect(review).toHaveText(/^0\s*قيد المراجعة$/);

  // Sara asks to mark TSK-109 done: an employee's "done" becomes an approval request.
  await page.getByRole("link", { name: /TSK-109/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "صفحة إعلانات الشركة" })).toBeVisible();
  await page.getByLabel("الحالة").selectOption({ label: "مكتملة" });
  await expect(page.getByText("أُرسل طلب اعتماد الإكمال إلى مدير القسم.")).toBeVisible();

  await page.goto("/my-tasks");
  await expect(review).toHaveText(/^1\s*قيد المراجعة\s*بانتظار الاعتماد: 1$/);
  // Until the department manager approves, nothing is done yet.
  await expect(tiles(page).filter({ hasText: "مهام مفتوحة" })).toHaveText(/^2\s*مهام مفتوحة/);
  await expect(page.getByRole("img", { name: "المنجز: 0 من 2 (0%)" })).toBeVisible();
});

test("the summary speaks English, left to right, and fits the screen", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.goto("/my-tasks");

  await expect(tiles(page, "My summary")).toHaveCount(5);
  await expect(tiles(page, "My summary").filter({ hasText: "Open tasks" })).toHaveText(/^2\s*Open tasks\s*of 2 tasks$/);
  await expect(tiles(page, "My summary").filter({ hasText: "Due today" })).toHaveText(/^0\s*Due today\s*1 in the next 7 days$/);
  await expect(tiles(page, "My summary").filter({ hasText: "Oldest" })).toHaveText(/^1\s*Late\s*Oldest: 2 days late$/);
  await expect(page.getByRole("region", { name: "My tasks by project" }).getByRole("link", { name: /Online booking platform.*open tasks:\s*2/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "My tasks by status: New 1, In progress 1" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Done: 0 of 2 tasks (0%)" })).toBeVisible();
  expect(await sideways(page)).toBe(0);
});
