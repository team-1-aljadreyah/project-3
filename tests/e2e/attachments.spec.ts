import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

const textFile = (name: string) => ({ name, mimeType: "text/plain", buffer: Buffer.from("ملاحظات تجريبية") });

test("a member attaches a file to a task, it is in the list and the history, and they can remove it", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/projects/1");
  await page.getByRole("link", { name: /TSK-109/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "صفحة إعلانات الشركة" })).toBeVisible();

  const files = page.getByRole("region", { name: "المرفقات" });
  // The hidden file picker behind "أرفق ملفاً" (choosing a file in the system window can't be automated).
  await files.locator('input[type="file"]').setInputFiles(textFile("ملاحظات-الإعلانات.txt"));
  await expect(page.getByText("أُرفق «ملاحظات-الإعلانات.txt».")).toBeVisible();
  await expect(files.getByRole("link", { name: /ملاحظات-الإعلانات\.txt/ })).toBeVisible();

  await page.getByRole("tab", { name: "سجل التحديثات" }).click();
  await expect(page.getByRole("tabpanel").getByText("أرفق الملف «ملاحظات-الإعلانات.txt»")).toBeVisible();

  await files.getByRole("button", { name: "احذف ملاحظات-الإعلانات.txt" }).click();
  await page.getByRole("dialog", { name: "حذف الملف" }).getByRole("button", { name: "احذف" }).click();
  await expect(files.getByRole("link", { name: /ملاحظات-الإعلانات\.txt/ })).toHaveCount(0);
});

test("a file type that isn't allowed is refused with the reason", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/projects/1");
  await page.getByRole("link", { name: /TSK-109/ }).click();
  const files = page.getByRole("region", { name: "المرفقات" });
  await files.locator('input[type="file"]').setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(files.getByRole("alert")).toHaveText(/«logo\.svg»: هذا النوع غير مسموح\./);
});

test("the project's files open from the board; a member can't remove the PM's file", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/projects/1");
  await page.getByRole("link", { name: "الملفات" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ملفات المشروع" })).toBeVisible();
  await expect(page.getByRole("link", { name: /خطة-المشروع\.txt/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /احذف خطة-المشروع/ })).toHaveCount(0);
});
