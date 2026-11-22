import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

// The administrator's console pages: import accounts, sessions and security, structure, system health.
const adminNav = (page: Page) => page.getByRole("navigation", { name: "أقسام إدارة النظام" });

test("the admin imports 3 rows with one bad email: 2 are created, 1 is skipped with the reason, and the log has it", async ({ page }) => {
  await signInAs(page, /حسن رعد/);
  await page.goto("/admin");
  await adminNav(page).getByRole("link", { name: "استيراد حسابات" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "استيراد حسابات" })).toBeVisible();

  await page.getByLabel("محتوى ملف CSV").fill(
    [
      "الاسم,English name,email,phone,job,title,team,password",
      'كرار محمد,Karrar Mohammed,karrar@demo.test,07700000001,موظف,"مطور، واجهات",فريق التطوير,Karrar-Start-26',
      "نور سالم,Noor Salem,noor-at-demo.test,,employee,محاسبة,,Noor-Start-2026",
      "ريم عادل,Reem Adel,reem@demo.test,,Team leader,قائدة فريق,,Reem-Start-2026",
    ].join("\n"),
  );
  await page.getByRole("button", { name: "افحص الصفوف" }).click();

  // The preview (a table on a computer, cards on a phone): two ready, one skipped with its reason.
  const rows =
    test.info().project.name === "phone"
      ? page.getByRole("list", { name: "الصفوف" }).getByRole("listitem")
      : page.getByRole("table", { name: "الصفوف وفحص كل صف" }).getByRole("row").filter({ has: page.getByRole("cell") });
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: "noor-at-demo.test" })).toContainText("البريد غير صحيح");
  await page.getByRole("button", { name: /^فيها مشكلة/ }).click();
  await expect(rows).toHaveCount(1);

  await page.getByRole("button", { name: "أنشئ 2 حساب" }).click();
  await expect(page.getByRole("heading", { name: "أُنشئ 2 حساب، وتُرك 1" })).toBeVisible();
  const created = page.getByRole("region", { name: "ما أُنشئ" });
  await expect(created).toContainText("كرار محمد");
  await expect(created).toContainText("ريم عادل");
  const skipped = page.getByRole("region", { name: "ما تُرك" });
  await expect(skipped).toContainText("السطر 2: نور سالم");
  await expect(skipped).toContainText("البريد غير صحيح");

  // They are in the users list, and the audit log has the import.
  await page.getByRole("link", { name: "افتح المستخدمين" }).click();
  await expect(page.getByRole("list", { name: "المستخدمون" }).getByRole("button", { name: /كرار محمد/ })).toBeVisible();
  await page.goto("/audit?action=users_imported");
  await expect(page.getByRole("list", { name: "العمليات" }).getByRole("listitem")).toHaveCount(1);
});

test("the admin signs a session out, and unlocks a locked account from the overview's 'needs attention'", async ({ page }) => {
  test.setTimeout(60_000);
  // Sara's password is typed wrong five times: her account locks.
  await page.goto("/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("البريد الإلكتروني").fill("employee@demo.test");
    await page.getByLabel("كلمة المرور").fill("wrong-password");
    await page.getByRole("button", { name: "دخول", exact: true }).click();
    await expect(page.getByText("البريد أو كلمة المرور غير صحيحة.")).toBeVisible();
  }
  await signInAs(page, /حسن رعد/);
  await page.goto("/admin");

  // The overview says so, and its line opens the security page at the locked accounts.
  const attention = page.getByRole("region", { name: "يحتاج إلى انتباه" });
  await attention.getByRole("link", { name: /حساب مقفل الآن/ }).click();
  await expect(page).toHaveURL(/\/admin\/security#locked/);
  await expect(page.getByRole("heading", { level: 1, name: "الجلسات والأمان" })).toBeVisible();

  // Her wrong passwords are counted by account and by address.
  const failed = page.getByRole("region", { name: /محاولات الدخول الخاطئة/ });
  await expect(failed.getByRole("table", { name: "حسب الحساب" }).getByRole("row").filter({ hasText: "employee@demo.test" })).toContainText("5");

  // Zainab's one session (her computer): end it.
  const sessions = page.getByRole("list", { name: "الجلسات حسب الشخص" });
  await expect(sessions.getByRole("list", { name: "جلسات زينب فاضل" }).getByRole("listitem")).toHaveCount(1);
  await sessions.getByRole("button", { name: /أنهِ جلسة زينب فاضل/ }).click();
  const confirm = page.getByRole("dialog", { name: "إنهاء هذه الجلسة؟" });
  await expect(confirm).toContainText("192.0.2.90");
  await confirm.getByRole("button", { name: "أخرجه" }).click();
  await expect(page.getByText(/انتهت الجلسة/)).toBeVisible();
  await expect(sessions.getByRole("list", { name: "جلسات زينب فاضل" })).toHaveCount(0);
  // The admin's own session can't be ended from here.
  await expect(sessions.getByRole("list", { name: "جلسات حسن رعد" }).getByText("هذا الجهاز")).toBeVisible();

  // Unlock Sara now.
  const locked = page.getByRole("region", { name: "الحسابات المقفلة" });
  await locked.getByRole("button", { name: "افتح حساب سارة علي الآن" }).click();
  await expect(page.getByText(/فُتح الحساب/)).toBeVisible();
  await expect(locked).toContainText("لا حساب مقفل الآن.");

  // Both are in the audit log.
  await page.goto("/audit");
  const log = page.getByRole("list", { name: "العمليات" });
  await expect(log.getByRole("listitem").filter({ hasText: "زينب فاضل" }).getByText(/أنهى جلسة دخول/)).toBeVisible();
  await expect(log.getByRole("listitem").filter({ hasText: "سارة علي" }).getByText(/فتح حساباً مقفلاً/)).toBeVisible();
});

test("the structure page assigns a team to a person with none", async ({ page }) => {
  await signInAs(page, /حسن رعد/);
  await page.goto("/admin");
  await page.getByRole("button", { name: "مستخدم جديد" }).click();
  const dialog = page.getByRole("dialog", { name: "مستخدم جديد" });
  await dialog.getByLabel("الاسم", { exact: true }).fill("ليلى سمير");
  await dialog.getByLabel("البريد الإلكتروني").fill("laila@demo.test");
  await dialog.getByLabel("كلمة المرور").fill("Laila-Start-2026");
  await dialog.getByLabel("المسمى الوظيفي").fill("مصممة واجهات");
  await dialog.getByRole("button", { name: "احفظ" }).click();
  await expect(page.getByText("أُضيف المستخدم.")).toBeVisible();

  await adminNav(page).getByRole("link", { name: /الهيكل التنظيمي/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "الهيكل التنظيمي" })).toBeVisible();
  const noTeam = page.getByRole("region", { name: /بلا فريق/ });
  await noTeam.getByLabel("فريق ليلى سمير").selectOption({ label: "فريق التطوير" });
  await noTeam.getByRole("button", { name: "عيّن" }).click();
  await expect(page.getByText("ليلى سمير الآن في فريق التطوير.")).toBeVisible();
  await expect(page.getByText(/الهيكل سليم/)).toBeVisible();
  await expect(page.getByRole("list", { name: "أعضاء فريق التطوير" })).toContainText("ليلى سمير");
});

test("system health: storage, backups, the version and the API, from the side menu", async ({ page }) => {
  await signInAs(page, /حسن رعد/);
  await page.goto("/admin");
  await adminNav(page).getByRole("link", { name: "صحة النظام" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "صحة النظام" })).toBeVisible();
  await expect(page.getByRole("region", { name: "المساحة" }).getByRole("table", { name: "المساحة حسب النوع" })).toContainText("الصور الشخصية");
  await expect(page.getByRole("region", { name: "النسخ الاحتياطي" })).toContainText("نجحت آخر نسخة");
  await expect(page.getByRole("region", { name: "عن النظام" })).toContainText("تجريبي");
  await expect(page.getByRole("region", { name: /يحتاج إلى انتباه/ })).toContainText("لا شيء يحتاج إلى انتباهك الآن.");
});

test("other jobs get the 'not for you' page; the CEO opens them all (the CEO rule)", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  for (const path of ["/admin/security", "/admin/import", "/admin/structure", "/admin/health"]) {
    await page.goto(path);
    await expect(page.getByText("هذه الصفحة لمسؤول النظام والمدير التنفيذي")).toBeVisible();
    await expect(adminNav(page)).toHaveCount(0);
  }
  await page.getByRole("button", { name: /حسابي/ }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await signInAs(page, /مريم العبيدي/);
  await page.goto("/admin/security");
  await expect(page.getByRole("heading", { level: 1, name: "الجلسات والأمان" })).toBeVisible();
  await expect(page.getByRole("list", { name: "جلسات مريم العبيدي" }).getByText("هذا الجهاز")).toBeVisible();
});
