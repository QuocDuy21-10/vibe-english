import { expect, test, type Page } from "@playwright/test";
import { LONG_WORD } from "./emulator";
import { MOBILE_NAV, measureOverflow, openAuthenticated } from "./fixtures";

const ROUTES = ["/dashboard", "/dictionary", "/topics", "/study", "/progress"];
// Required matrix plus both sides of the sm (640), md (768) and lg (1024) breakpoints and two landscape phones.
const VIEWPORTS: Array<[number, number]> = [
  [320, 568], [360, 800], [375, 667], [390, 844], [430, 932], [639, 900], [640, 900], [767, 1024],
  [768, 1024], [1023, 768], [1024, 768], [1280, 800], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440],
  [568, 320], [844, 390],
];

async function startDueReview(page: Page) {
  await page.getByRole("button", { name: /Cần ôn tập/ }).click();
  await expect(page.getByRole("button", { name: "Hiện nghĩa tiếng Việt" })).toBeVisible();
}

async function bottomOf(page: Page, selector: string) {
  return (await page.locator(selector).first().boundingBox())!;
}

test.describe("layout matrix", () => {
  test.skip(({ isMobile }) => isMobile, "matrix sets its own viewports");

  test("login page fits every viewport", async ({ page }) => {
    await page.goto("/login");
    for (const [width, height] of VIEWPORTS) {
      await page.setViewportSize({ width, height });
      const result = await measureOverflow(page);
      expect(result, `${width}x${height}`).toEqual({ scrollOverflow: 0, offenders: [] });
    }
    await expect(page.getByRole("button", { name: /Đăng nhập với Google/ })).toBeInViewport();
  });

  for (const route of ROUTES) {
    test(`${route} has no horizontal overflow`, async ({ page }) => {
      await openAuthenticated(page, route);
      for (const [width, height] of VIEWPORTS) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(150);
        const result = await measureOverflow(page);
        expect(result, `${route} at ${width}x${height}`).toEqual({ scrollOverflow: 0, offenders: [] });
        // Exactly one navigation is visible on each side of md.
        await expect(page.locator(MOBILE_NAV)).toBeVisible({ visible: width < 768 });
        await expect(page.getByRole("navigation", { name: "Desktop Navigation" })).toBeVisible({ visible: width >= 768 });
      }
    });
  }
});

test.describe("shared layout", () => {
  test("avatar falls back to an initial when the account has no photo", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await openAuthenticated(page, "/dashboard");
    await expect(page.getByRole("img", { name: "E2E Learner" })).toHaveText("E");
    expect(errors.filter((text) => text.includes('empty string ("")'))).toEqual([]);
  });

  test("bottom navigation never hides the end of the page", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    for (const route of ROUTES) {
      await openAuthenticated(page, route);
      // Sections below the fold load asynchronously, so re-scroll until the page settles.
      await expect.poll(() => page.evaluate((navSelector) => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        const navTop = document.querySelector(navSelector)!.getBoundingClientRect().top;
        const visible = [...document.querySelectorAll("main *")].filter((el) => (el as HTMLElement).offsetParent !== null);
        return Math.max(...visible.map((el) => el.getBoundingClientRect().bottom)) - navTop;
      }, MOBILE_NAV), { message: route }).toBeLessThanOrEqual(0);
    }
  });

  test("primary mobile controls are at least 44px", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await openAuthenticated(page, "/dictionary");
    const targets = [
      page.getByRole("button", { name: "Đăng xuất" }),
      page.getByRole("button", { name: /^Xóa từ / }).first(),
      page.getByRole("button", { name: /^Chỉnh sửa từ / }).first(),
      page.getByRole("button", { name: /^Xem ví dụ của / }).first(),
      page.locator("[data-slot=select-trigger]").first(),
      ...(await page.locator(`${MOBILE_NAV} a`).all()),
    ];
    const expectTouchSize = async (target: (typeof targets)[number]) => {
      const box = (await target.boundingBox())!;
      expect(Math.min(box.width, box.height), await target.evaluate((el) => el.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(44);
    };
    for (const target of targets) await expectTouchSize(target);
    await page.goto("/progress");
    await expectTouchSize(page.getByRole("button", { name: "Trang sau" }));
    await expectTouchSize(page.getByRole("button", { name: "Trang 1" }));
  });
});

test.describe("dictionary", () => {
  test("filter selects show Vietnamese labels, not raw values", async ({ page }) => {
    await openAuthenticated(page, "/dictionary");
    const triggers = page.locator("[data-slot=select-trigger]");
    await expect(triggers.filter({ hasText: "Tất cả trạng thái" })).toHaveCount(1);
    await expect(page.getByRole("combobox", { name: "Kiểu khớp tìm kiếm" })).toContainText("Có chứa");
    await expect(triggers.filter({ hasText: "Mới nhất trước" })).toHaveCount(1);
    for (const raw of ["all", "contains", "newest"]) {
      await expect(triggers.filter({ hasText: new RegExp(`^${raw}$`) })).toHaveCount(0);
    }
  });

  test("add-word dialog keeps Save reachable, validates, and restores focus", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openAuthenticated(page, "/dictionary");
    const trigger = page.getByRole("button", { name: /Thêm từ/ });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    const save = dialog.getByRole("button", { name: "Lưu vào từ điển" });
    await expect(save).toBeInViewport({ ratio: 1 });
    expect((await dialog.boundingBox())!.height).toBeLessThanOrEqual(568);

    await save.click();
    await expect(dialog.getByText("Vui lòng nhập từ tiếng Anh.")).toBeVisible();
    await expect(dialog.getByPlaceholder(/Ví dụ: resilient/)).toBeFocused();

    await dialog.locator("form").evaluate((form) => { form.scrollTop = form.scrollHeight; });
    await expect(save).toBeInViewport({ ratio: 1 });

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("bulk import dialog tabs and footer fit a 320px phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openAuthenticated(page, "/dictionary");
    await page.getByRole("button", { name: /Nhập từ/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("tab")).toHaveCount(2);
    for (const tab of await dialog.getByRole("tab").all()) {
      const fits = await tab.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      expect(fits, await tab.innerText()).toBe(true);
    }
    const dialogBox = (await dialog.boundingBox())!;
    const importBox = (await dialog.getByRole("button", { name: /Import/ }).boundingBox())!;
    expect(importBox.x).toBeGreaterThanOrEqual(dialogBox.x);
    expect(importBox.x + importBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
  });
});

test.describe("study", () => {
  test("flashcard flips by touch and rating buttons sit above the bottom nav", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await openAuthenticated(page, "/study");
    await startDueReview(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const card = page.getByRole("button", { name: "Hiện nghĩa tiếng Việt" });
    await card.tap({ position: { x: 24, y: 24 } });
    await expect(page.getByRole("button", { name: "Ẩn nghĩa tiếng Việt" })).toBeVisible();

    const nav = await bottomOf(page, MOBILE_NAV);
    for (const name of ["Again (Quên)", "Hard (Khó)", "Good (Nhớ)", "Easy (Dễ)"]) {
      const box = (await page.getByRole("button", { name }).boundingBox())!;
      expect(box.y + box.height, name).toBeLessThanOrEqual(nav.y);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Good (Nhớ)" }).click();
    await expect(page.getByRole("button", { name: "Hiện nghĩa tiếng Việt" })).toBeVisible();
  });

  test("320x568: rating buttons stay reachable by scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openAuthenticated(page, "/study");
    await startDueReview(page);
    await page.getByRole("button", { name: "Hiện nghĩa tiếng Việt" }).click({ position: { x: 24, y: 24 } });
    const easy = page.getByRole("button", { name: "Easy (Dễ)" });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const nav = await bottomOf(page, MOBILE_NAV);
    const box = (await easy.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
  });

  test("flashcard is keyboard operable", async ({ page }) => {
    await openAuthenticated(page, "/study");
    await startDueReview(page);
    const card = page.getByRole("button", { name: "Hiện nghĩa tiếng Việt" });
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Ẩn nghĩa tiếng Việt" })).toBeFocused();
  });

  test("side arrows only appear where they fit (lg and up)", async ({ page, isMobile }) => {
    test.skip(isMobile, "sets its own viewports");
    await openAuthenticated(page, "/study");
    await startDueReview(page);
    for (const width of [768, 900, 1023, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const visibleNext = page.getByRole("button", { name: "Câu tiếp theo" }).filter({ visible: true });
      await expect(visibleNext).toHaveCount(1);
      const box = (await visibleNext.boundingBox())!;
      expect(box.x, `${width}`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${width}`).toBeLessThanOrEqual(width);
    }
  });

  test("a very long word is fully readable on the card front", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openAuthenticated(page, "/study");
    await page.getByRole("button", { name: /Công việc/ }).click();
    const heading = page.locator("h2.font-black");
    for (let i = 0; i < 12 && (await heading.innerText()) !== LONG_WORD; i++) {
      await page.getByRole("button", { name: "Câu tiếp theo" }).filter({ visible: true }).click();
    }
    await expect(heading).toHaveText(LONG_WORD);
    const front = heading.locator("xpath=ancestor::*[contains(@class,'backface-hidden')][1]");
    // Content either fits or the face scrolls; the start of the content must never be cut off.
    const state = await front.evaluate((el) => ({
      overflowY: getComputedStyle(el).overflowY,
      fits: el.scrollHeight <= el.clientHeight + 1,
      firstChildTop: el.querySelector("[data-slot=badge]")!.getBoundingClientRect().top - el.getBoundingClientRect().top,
    }));
    expect(state.fits || state.overflowY === "auto").toBe(true);
    expect(state.firstChildTop).toBeGreaterThanOrEqual(0);
  });

  test("quiz answer can be submitted with Enter and shows feedback", async ({ page }) => {
    await openAuthenticated(page, "/study");
    await startDueReview(page);
    await page.getByRole("button", { name: "Điền từ", exact: true }).click();
    const input = page.locator("main input").first();
    await input.fill("zzzz");
    await input.press("Enter");
    await expect(page.getByText(/Gợi ý:/)).toBeVisible();
  });
});

test.describe("accessibility preferences", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("reduced motion flips the card without a 3D rotation in progress", async ({ page }) => {
    await openAuthenticated(page, "/study");
    await startDueReview(page);
    await page.getByRole("button", { name: "Hiện nghĩa tiếng Việt" }).click({ position: { x: 24, y: 24 } });
    // The spring flip takes ~600ms; with reduced motion the card must reach its end state within a frame or two.
    const flipped = page.getByRole("button", { name: "Ẩn nghĩa tiếng Việt" });
    await expect
      .poll(() => flipped.evaluate((el) => getComputedStyle(el).transform), { timeout: 250, intervals: [16] })
      .toMatch(/^matrix3d\(-1, 0, [^,]+, 0, 0, 1, 0, 0|^matrix\(-1, 0, 0, 1/);
  });
});
