import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

// Project 1 works in sprints: "الدورة 4" runs today, "الدورة 3" ended, "الدورة 5" is next; TSK-121 waits in the backlog.

test("the PM plans a backlog task into the sprint, then ends the sprint and moves the unfinished tasks on", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/1");
  await expect(page.getByRole("tab", { name: "لوحة الدورة" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("اختر الدورة")).toHaveValue("1"); // the sprint running today
  const planned = page.getByText("المخطط", { exact: true }).locator("..");

  await page.getByRole("tab", { name: "قائمة الانتظار" }).click();
  const backlog = page.getByRole("list", { name: "قائمة الانتظار" });
  await backlog.getByLabel("أضف TSK-121 إلى دورة").selectOption({ label: "الدورة 4" });
  await expect(page.getByText("أُضيفت TSK-121 إلى «الدورة 4».")).toBeVisible();
  await expect(page.getByText("قائمة الانتظار فارغة")).toBeVisible();

  await page.getByRole("tab", { name: "لوحة الدورة" }).click();
  await expect(page.getByRole("link", { name: /TSK-121/ })).toBeVisible();
  await expect(planned).toContainText("9");

  await page.getByRole("button", { name: "أنهِ الدورة" }).click();
  const dialog = page.getByRole("dialog", { name: "إنهاء الدورة" });
  await expect(dialog.getByText(/أُنجز 1 من 9 مهام، وبقي 8/)).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /الدورة 5/ })).toBeChecked(); // the next open sprint by default
  await dialog.getByRole("button", { name: "أنهِ الدورة" }).click();
  await expect(page.getByText("انتهت «الدورة 4».")).toBeVisible();

  // The board moves on to "الدورة 5", which now has the 8 unfinished tasks.
  await expect(page.getByLabel("اختر الدورة")).toHaveValue("3");
  await expect(page.getByRole("link", { name: /TSK-104/ })).toBeVisible();
  await page.getByLabel("اختر الدورة").selectOption("1");
  await expect(page.getByText("منتهية", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "أنهِ الدورة" })).toHaveCount(0);

  // The task's history says where it went.
  await page.goto("/projects/1");
  await page.getByRole("link", { name: /TSK-104/ }).click();
  await page.getByRole("tab", { name: "السجل" }).click();
  await expect(page.getByRole("tabpanel").getByText("نقلها إلى الدورة «الدورة 5»")).toBeVisible();
});

test("an employee sees the sprint and the backlog but can't end a sprint or plan tasks", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/projects/1");
  await expect(page.getByRole("link", { name: /TSK-104/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "أنهِ الدورة" })).toHaveCount(0);
  await page.getByRole("tab", { name: "قائمة الانتظار" }).click();
  await expect(page.getByRole("link", { name: /TSK-121/ })).toBeVisible();
  await expect(page.getByLabel("أضف TSK-121 إلى دورة")).toHaveCount(0);
});

test("a project without sprints keeps the plain Kanban board", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/2");
  await expect(page.getByRole("heading", { name: "لوحة المهام" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "لوحة الدورة" })).toHaveCount(0);
});
