import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("a page that needs sign-in sends you to the login page, and back after signing in", async ({ page }) => {
  await page.goto("/projects/1");
  await expect(page).toHaveURL(/\/login\?next=%2Fprojects%2F1/);
  await page.getByLabel("البريد الإلكتروني").fill("pm@demo.test");
  await page.getByLabel("كلمة المرور").fill("123456");
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/1$/);
  await expect(page.getByRole("heading", { level: 1, name: /منصة الحجز الإلكتروني/ })).toBeVisible();
});

test("empty fields and a wrong password show clear messages", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page.getByText("اكتب بريدك الإلكتروني.")).toBeVisible();
  await expect(page.getByText("اكتب كلمة المرور.")).toBeVisible();

  await page.getByLabel("البريد الإلكتروني").fill("pm@demo.test");
  await page.getByLabel("كلمة المرور").fill("wrong");
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  // (Next.js keeps an empty role="alert" of its own for page changes, so the message is found by its text.)
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("البريد أو كلمة المرور غير صحيحة.");
});

test("signing out goes back to the login page and stays signed out", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
