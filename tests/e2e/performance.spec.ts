import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the team leader reviews Sara: counted scores, stars for quality and teamwork, notes, then final", async ({ page }) => {
  await signInAs(page, /مصطفى جواد/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الأداء" }).click();
  await page.getByRole("table", { name: "أداء الموظفين" }).getByRole("link", { name: /سارة علي/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "سارة علي" })).toBeVisible();

  await page.getByRole("button", { name: "تقييم جديد" }).click();
  const dialog = page.getByRole("dialog", { name: "تقييم أداء سارة علي" });
  await expect(dialog.getByRole("button", { name: "اعتمد التقييم" })).toBeDisabled(); // stars missing
  await dialog.getByLabel("درجة جودة العمل").selectOption("5");
  await dialog.getByLabel("درجة التعاون والتواصل").selectOption("4");
  await dialog.getByLabel("ملاحظات المسؤول المباشر").fill("تسليم متقن هذا الشهر.");
  await dialog.getByRole("button", { name: "اعتمد التقييم" }).click();
  await expect(page.getByText("اعتُمد التقييم وأُبلغ الموظف.")).toBeVisible();
  await expect(page.getByText("تسليم متقن هذا الشهر.")).toBeVisible();
});

test("Sara sees her own performance and her final reviews, and can't write one", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "الأداء" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "أدائي" })).toBeVisible();
  await expect(page.getByRole("list", { name: "تطور التقييم" }).getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("تحسن واضح في الالتزام بالمواعيد")).toBeVisible();
  await expect(page.getByRole("button", { name: "تقييم جديد" })).toHaveCount(0);
});

test("the CEO's criteria: weights must add up to 100; a change needs a new approval", async ({ page }) => {
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/performance/criteria");
  await expect(page.getByText(/معتمدة منذ/)).toBeVisible();
  await page.getByLabel("وزن المعيار 1").fill("35");
  await expect(page.getByText("مجموع الأوزان: 110 من 100")).toBeVisible();
  await page.getByLabel("وزن المعيار 3").fill("20");
  await page.getByRole("button", { name: "احفظ المعايير" }).click();
  await expect(page.getByText("حُفظت المعايير. اعتمدها لتُستعمل.")).toBeVisible();
  await expect(page.getByText(/غير معتمدة/)).toBeVisible();
  await page.getByRole("button", { name: "اعتمد المعايير" }).click();
  await expect(page.getByText(/معتمدة منذ/)).toBeVisible();
});
