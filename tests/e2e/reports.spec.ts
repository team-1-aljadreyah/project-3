import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the CEO's dashboard: totals, projects that need a decision, teams, staff, bugs and announcements", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "لوحة التحكم" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "لوحة التحكم" })).toBeVisible();
  await expect(page.getByText("المشاريع النشطة")).toBeVisible();
  await expect(page.getByText("أخطاء مفتوحة")).toBeVisible();
  await expect(page.getByRole("region", { name: "مستوى الفرق" }).getByText("فريق التطوير")).toBeVisible();
  await expect(page.getByRole("region", { name: "ملخص الموظفين" }).getByText("سارة علي")).toBeVisible();
  await expect(page.getByRole("region", { name: "آخر الإعلانات" }).getByRole("link").first()).toBeVisible();
  // The whole row of a project that needs a decision opens its board.
  const attention = page.getByRole("region", { name: "مشاريع تحتاج إلى قرار" });
  const first = attention.getByRole("link").first();
  if ((await first.count()) > 0) {
    await first.click();
    await expect(page).toHaveURL(/\/projects\/\d+$/);
  }
});

test("the CEO's dashboard opens with the night banner: the page's name, today's numbers and the way to the reports", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/dashboard");
  const banner = page.getByRole("region", { name: /لوحة التحكم/ });
  await expect(banner.getByText("في مكان واحد.")).toBeVisible();
  await expect(banner.getByText(/مشاريع نشطة/)).toBeVisible();
  await banner.getByRole("link", { name: "كل التقارير" }).click();
  await expect(page).toHaveURL(/\/reports$/);
});

test("the department manager's dashboard: the task calendar and the board over their projects; a card opens its task", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "لوحة التحكم" })).toBeVisible();
  await expect(page.getByRole("region", { name: "تقويم المهام" }).getByText("اليوم")).toBeVisible();
  const board = page.getByRole("region", { name: "كل المهام" });
  for (const column of ["للتنفيذ", "قيد التنفيذ", "قيد المراجعة", "مكتملة"]) await expect(board.getByRole("list", { name: column })).toBeVisible();
  await board.getByRole("list", { name: "قيد التنفيذ" }).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/tasks\/\d+$/);
});

test("the department manager's dashboard opens with a greeting and their projects turning round the progress", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/dashboard");
  const slide = page.getByRole("region", { name: /لوحة التحكم/ });
  await expect(slide.getByText("أحمد", { exact: true })).toBeVisible();
  // The picture says the same in words, and each project in the list opens it.
  await expect(slide.getByRole("img", { name: /مشاريع قسمك: .*منصة الحجز الإلكتروني/ })).toBeVisible();
  await slide.getByRole("link", { name: "منصة الحجز الإلكتروني" }).click();
  await expect(page).toHaveURL(/\/projects\/\d+$/);
});

test("the team leader's dashboard opens with the team's slide: the sphere's numbers are also in words", async ({ page }) => {
  await signInAs(page, /مصطفى جواد/);
  await page.goto("/dashboard");
  const slide = page.getByRole("region", { name: /لوحة التحكم/ });
  await expect(slide.getByText("فريق التطوير")).toBeVisible();
  await expect(slide.getByRole("img", { name: /توزيع مهام الفريق: مكتملة \d+%/ })).toBeVisible();
  await expect(slide.getByText(/قيد المراجعة: \d+/)).toBeVisible();
  // The rest of the dashboard is still under it.
  await expect(page.getByText("المشاريع النشطة")).toBeVisible();
});

test("the monitoring officer's dashboard: who is signed in, the summary cards, and every project against its plan with a filter and a search", async ({ page }) => {
  await signInAs(page, /هدى ناصر/);
  await page.goto("/dashboard");
  const top = page.getByRole("region", { name: "لوحة التحكم" });
  await expect(top.getByText("هدى ناصر")).toBeVisible();
  await expect(page.getByText(/آخر تحديث للبيانات/)).toBeVisible();
  await expect(page.getByText("المشاريع النشطة")).toBeVisible();
  const list = page.getByRole("region", { name: "متابعة المشاريع" });
  await expect(list.getByRole("link", { name: /منصة الحجز الإلكتروني/ })).toBeVisible();
  await list.getByLabel("ابحث باسم المشروع").fill("المبيعات");
  await expect(list.getByRole("link")).toHaveCount(1);
  await list.getByLabel("ابحث باسم المشروع").fill("");
  await list.getByLabel("اعرض المشاريع").selectOption({ label: "متأخرة عن الخطة" });
  await expect(list.getByRole("link", { name: /تطبيق المبيعات/ })).toHaveCount(0);
  // Every row opens its project.
  await list.getByLabel("اعرض المشاريع").selectOption({ label: "كل المشاريع" });
  await list.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/projects\/\d+$/);
});

test("the monitoring officer's banner has her character: hidden from screen readers and clear of the card's link", async ({ page }) => {
  await signInAs(page, /هدى ناصر/);
  await page.goto("/dashboard");
  const top = page.getByRole("region", { name: "لوحة التحكم" });
  const character = top.locator(".wave-banner .mc");
  await expect(character).toBeVisible();
  await expect(character).toHaveAttribute("aria-hidden", "true");
  // She stands behind the profile card: her box never covers the "All reports" link.
  const link = top.getByRole("link", { name: "كل التقارير" });
  await expect(link).toBeVisible();
  const a = await character.boundingBox();
  const b = await link.boundingBox();
  if (!a || !b) throw new Error("the character or the link has no box");
  const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  expect(overlap).toBe(false);
});

test("reports: by project, by team and person (filter), by sprint with velocity; each table downloads as CSV", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/reports");
  const projects = page.getByRole("table", { name: "تقرير المشاريع" });
  await expect(projects.getByRole("link", { name: "منصة الحجز الإلكتروني" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "نزّل الجدول (CSV)" }).click();
  expect((await download).suggestedFilename()).toBe("projects-report.csv");

  await page.getByRole("tab", { name: "حسب الفريق والموظف" }).click();
  const people = page.getByRole("table", { name: "تقرير الموظفين" });
  await expect(people.getByText("سارة علي")).toBeVisible();
  await page.getByLabel("اختر الفريق").selectOption({ label: "بلا فريق" });
  await expect(people.getByText("سارة علي")).toHaveCount(0);

  await page.getByRole("tab", { name: "حسب الدورة" }).click();
  await expect(page.getByText("السرعة")).toBeVisible();
  await expect(page.getByRole("list", { name: "الدورات: المخطط والمنجز" }).getByText("الدورة 3")).toBeVisible();
});

test("employees don't have the dashboard or the reports", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  const nav = page.getByRole("navigation", { name: "القائمة الرئيسية" });
  await expect(nav.getByText("لوحة التحكم")).toHaveCount(0);
  await expect(nav.getByText("التقارير")).toHaveCount(0);
  await page.goto("/reports");
  await expect(page.getByText("التقارير للإدارة")).toBeVisible();
});

test("each dashboard greets the person by name, with the time and the date", async ({ page }) => {
  for (const [who, first, path] of [
    [/هدى ناصر/, "هدى", "/dashboard"],
    [/مريم العبيدي/, "مريم", "/dashboard"],
    [/مصطفى جواد/, "مصطفى", "/dashboard"],
    [/أحمد كريم/, "أحمد", "/dashboard"],
    [/سارة علي/, "سارة", "/my-tasks"],
  ] as const) {
    await signInAs(page, who);
    await page.goto(path);
    await expect(page.getByText(new RegExp(`(صباح الخير|نهارك سعيد|مساء الخير)، ${first}`))).toBeVisible();
    await expect(page.locator("time").filter({ hasText: /\d{1,2}:\d{2}/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /حسابي/ }).click();
    await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  }
});
