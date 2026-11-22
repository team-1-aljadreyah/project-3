import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

// The installable app: the manifest and its icons, the service worker and the offline page, and the install offers.

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

const openAccount = (page: Page) => page.getByRole("button", { name: /حسابي/ }).click();
const installItem = (page: Page) => page.getByRole("menuitem", { name: /ثبّت التطبيق/ });

test("every page links the manifest; it is valid and its icons load", async ({ page, request }) => {
  await page.goto("/login");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");
  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ start_url: "/", scope: "/", display: "standalone", lang: "ar", dir: "rtl", name: "منصة المشاريع" });
  const icons: { src: string; sizes: string; purpose: string }[] = manifest.icons;
  expect(icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));

  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  for (const src of [...icons.map((i) => i.src), apple!]) {
    const icon = await request.get(src);
    expect(icon.ok(), src).toBe(true);
    expect(icon.headers()["content-type"]).toContain("image/png");
  }
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
});

test("the service worker and the offline page are served", async ({ request }) => {
  const sw = await request.get("/sw.js?v=test");
  expect(sw.ok()).toBe(true);
  expect(sw.headers()["content-type"]).toContain("javascript");
  expect(await sw.text()).toContain("function cachePlan");

  const offline = await request.get("/offline.html");
  expect(offline.ok()).toBe(true);
  const html = await offline.text();
  expect(html).toContain("لا يوجد اتصال بالإنترنت");
  expect(html).toContain("أعد المحاولة");
});

test("the service worker takes over; offline, a page opened before still opens and a new one shows the offline page", async ({ page, context }) => {
  await signInAs(page, /أحمد كريم/);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 }).toBe(true);
  // A full load of a page, now through the worker: it keeps the page and its files.
  await page.goto("/my-tasks");
  await expect(page.getByRole("heading", { level: 1, name: "مهامي" })).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "مهامي" })).toBeVisible();
    await page.goto("/never-opened-page");
    await expect(page.getByRole("heading", { level: 1, name: "لا يوجد اتصال بالإنترنت" })).toBeVisible();
    await expect(page.getByRole("button", { name: "أعد المحاولة" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("'Install the app' shows only when the browser offers it, and opens the browser's own window", async ({ page }) => {
  await signInAs(page, /سارة علي/);
  await openAccount(page);
  await expect(page.getByRole("menuitem", { name: "تسجيل الخروج" })).toBeVisible();
  await expect(installItem(page)).toHaveCount(0);
  await page.keyboard.press("Escape");

  // What Chrome does when the site can be installed (the real event needs the browser's own checks over time).
  await page.evaluate(() => {
    const offer = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(offer, {
      prompt: async () => void ((window as unknown as { prompted: boolean }).prompted = true),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(offer);
  });
  await openAccount(page);
  await installItem(page).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
  // Installed: the offer is gone.
  await openAccount(page);
  await expect(page.getByRole("menuitem", { name: "تسجيل الخروج" })).toBeVisible();
  await expect(installItem(page)).toHaveCount(0);
});

test.describe("on an iPhone", () => {
  test.use({ userAgent: IPHONE_SAFARI });

  test("'Install the app' opens the how-to: Share, then Add to Home Screen", async ({ page }) => {
    await signInAs(page, /سارة علي/);
    await openAccount(page);
    await installItem(page).click();
    const dialog = page.getByRole("dialog", { name: "ثبّت المنصة على جهازك" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("اضغط زر المشاركة")).toBeVisible();
    await expect(dialog.getByText("اختر «إضافة إلى الشاشة الرئيسية»")).toBeVisible();
    await dialog.getByRole("button", { name: "حسناً" }).click();
    await expect(dialog).toBeHidden();
  });

  test("a phone gets the install hint once; closing it is remembered", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "the hint is for phones");
    await signInAs(page, /سارة علي/);
    const hint = page.getByRole("complementary", { name: "تثبيت المنصة" });
    await expect(hint).toContainText("ثبّت المنصة على شاشتك الرئيسية");
    await hint.getByRole("button", { name: "إخفاء" }).click();
    await expect(hint).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "المشاريع" })).toBeVisible();
    await expect(hint).toHaveCount(0);
  });
});

test("the sign-in page has 'Download the app': steps for this browser, or the browser's own window when it offers one", async ({ page }) => {
  await page.goto("/login");
  const download = page.getByRole("button", { name: "حمّل التطبيق" });
  // No offer from the browser yet: short steps for this browser (Chrome here).
  await download.click();
  const dialog = page.getByRole("dialog", { name: "ثبّت المنصة على جهازك" });
  // The test browser is Chrome: its own steps, not Edge's.
  await expect(dialog.getByText("Chrome على الحاسوب")).toBeVisible();
  await expect(dialog.getByText(/«تثبيت الصفحة كتطبيق»/)).toBeVisible();
  await expect(dialog.getByText(/Edge/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "حسناً" }).click();

  // The browser offers it: the button opens the browser's own window, and once installed it goes away.
  await page.evaluate(() => {
    const offer = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(offer, {
      prompt: async () => void ((window as unknown as { prompted: boolean }).prompted = true),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(offer);
  });
  await download.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
  await expect(download).toHaveCount(0);
});
