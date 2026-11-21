import { deflateSync, crc32 } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

/** A small real PNG, made here (no file on disk, no real photo): a wine and blush pattern. */
function makePng(w = 64, h = 48) {
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([head, typed, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const rows = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const at = y * (w * 3 + 1) + 1 + x * 3;
      const wine = (x + y) % 16 < 8;
      rows.set(wine ? [124, 14, 68] : [242, 218, 206], at);
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

const accountButton = (page: Page) => page.getByRole("button", { name: /حسابي/ });

test("a person sets their picture: it shows in the top bar at once and after a reload; then they remove it", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await expect(accountButton(page).locator("img")).toHaveCount(0);

  // The camera on the big avatar opens the window straight on choosing a picture.
  await accountButton(page).click();
  await page.getByRole("menuitem", { name: "غيّر صورتك الشخصية" }).click();
  const dialog = page.getByRole("dialog", { name: "صورتي الشخصية" });
  await expect(dialog).toBeVisible();

  // A file that is not a picture says so clearly.
  await dialog.locator("input[type=file]").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("نص") });
  await expect(dialog.getByRole("alert")).toHaveText("اختر صورة بصيغة JPEG أو PNG أو WebP.");

  await dialog.locator("input[type=file]").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: makePng() });
  await expect(dialog.getByRole("application")).toBeVisible();
  await dialog.getByLabel("التكبير").fill("1.5");
  await dialog.getByRole("button", { name: "احفظ الصورة" }).click();
  await expect(page.getByText("حُفظت صورتك.")).toBeVisible();
  await expect(dialog).toBeHidden();

  // The top bar shows the small square the browser made, without a reload.
  const img = accountButton(page).locator("img");
  await expect(img).toHaveAttribute("src", /^data:image\/(webp|jpeg);base64,/);
  const size = await img.evaluate((el: HTMLImageElement) => ({ w: el.naturalWidth, h: el.naturalHeight }));
  expect(size).toEqual({ w: 256, h: 256 });
  await page.reload();
  await expect(accountButton(page).locator("img")).toHaveAttribute("src", /^data:image\//);

  // Removing it asks first, then the initial is back.
  await accountButton(page).click();
  await page.getByRole("menuitem", { name: "ملفي الشخصي" }).click();
  const profile = page.getByRole("dialog", { name: "ملفي الشخصي" });
  await profile.getByRole("button", { name: "أزل الصورة" }).click();
  await profile.getByRole("button", { name: "نعم، أزِلها" }).click();
  await expect(page.getByText("أُزيلت صورتك.")).toBeVisible();
  await expect(accountButton(page).locator("img")).toHaveCount(0);
});

test("the account menu: keyboard, Escape gives the focus back, and it fits the screen", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await accountButton(page).focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "حسابي" });
  await expect(menu).toBeVisible();
  // From the keyboard, the first item (the picture) takes the focus; the arrows move on.
  await expect(menu.getByRole("menuitem", { name: "غيّر صورتك الشخصية" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitemradio", { name: "الوضع النهاري" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem", { name: "تسجيل الخروج" })).toBeFocused();

  const box = (await menu.boundingBox())!;
  const width = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);

  // An employee has "My performance"; it opens their own page.
  await expect(menu.getByRole("menuitem", { name: "أدائي" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(accountButton(page)).toBeFocused();
});

test("a picture one person sets is what everyone else sees: the dashboard, the board, the task", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, /سارة علي/);
  await accountButton(page).click();
  await page.getByRole("menuitem", { name: "غيّر صورتك الشخصية" }).click();
  const dialog = page.getByRole("dialog", { name: "صورتي الشخصية" });
  await dialog.locator("input[type=file]").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: makePng() });
  await dialog.getByRole("button", { name: "احفظ الصورة" }).click();
  await expect(page.getByText("حُفظت صورتك.")).toBeVisible();

  // Someone else: the CEO.
  await accountButton(page).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await page.getByRole("button", { name: /مريم العبيدي/ }).click();
  await expect(page.getByRole("navigation", { name: "القائمة الرئيسية" })).toBeVisible();
  await page.goto("/dashboard");
  const staff = page.getByRole("region", { name: "ملخص الموظفين" });
  await expect(staff.getByRole("listitem").filter({ hasText: "سارة علي" }).locator("img")).toHaveAttribute("src", /^data:image\//);
  // Her card on the project's board, and her name on the task.
  await page.goto("/projects/1");
  await page.getByRole("tab", { name: "كل المهام" }).click();
  const card = page.getByRole("link", { name: /TSK-118/ }).first();
  await expect(card.locator("img")).toHaveAttribute("src", /^data:image\//);
  await page.goto("/tasks/1");
  await expect(page.locator("dd").filter({ hasText: "سارة علي" }).locator("img")).toHaveAttribute("src", /^data:image\//);
});
