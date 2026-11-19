import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("a task shows the pull requests and commits that mention it; the links open GitHub", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.goto("/projects/1");
  await page.getByRole("link", { name: /TSK-104/ }).click();
  const gh = page.getByRole("region", { name: "GitHub" });
  const pr = gh.getByRole("link", { name: /ربط لوحة كانبان بواجهة المهام/ });
  await expect(pr).toHaveAttribute("href", "https://github.com/aljadreyah/booking-web/pull/41");
  await expect(pr).toHaveAttribute("target", "_blank");
  await expect(gh.getByText("مفتوح")).toBeVisible();
  await expect(gh.getByRole("link", { name: /board loads tasks/ })).toBeVisible();
});

test("the PM turns GitHub on for another project; its tasks then have a GitHub section", async ({ page }) => {
  await signInAs(page, /أحمد كريم/);
  await page.goto("/projects/2/settings");
  await page.getByRole("tab", { name: "GitHub" }).click();
  await page.getByLabel("اربط هذا المشروع بـ GitHub").check();
  await page.getByLabel("مستودع جديد (المالك/الاسم)").fill("not a repo");
  await page.getByRole("button", { name: "أضف" }).click();
  await expect(page.getByText(/اكتب المستودع هكذا/)).toBeVisible();
  await page.getByLabel("مستودع جديد (المالك/الاسم)").fill("aljadreyah/sales-app");
  await page.getByRole("button", { name: "أضف" }).click();
  await page.getByRole("button", { name: "احفظ إعداد GitHub" }).click();
  await expect(page.getByText("حُفظ إعداد GitHub.")).toBeVisible();

  await page.goto("/projects/2");
  await page.getByRole("link", { name: /TSK-201/ }).click();
  await expect(page.getByRole("region", { name: "GitHub" }).getByText(/لا طلبات سحب ولا إيداعات/)).toBeVisible();
});
