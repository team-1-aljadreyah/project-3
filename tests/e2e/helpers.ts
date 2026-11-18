import { expect, type Page } from "@playwright/test";

/** Signs in with a demo account's one-tap button (the demo build only) and waits for the projects page. */
export async function signInAs(page: Page, name: string | RegExp) {
  await page.goto("/login");
  await page.getByRole("button", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name: "المشاريع" })).toBeVisible();
}
