import { expect, type Page } from "@playwright/test";
import { createGoogleUser, persistSession } from "./emulator";

export const MOBILE_NAV = 'nav[aria-label="Mobile Navigation"]';

/** Signs the emulator account in and opens `path` once the authenticated layout has rendered. */
export async function openAuthenticated(page: Page, path: string) {
  await persistSession(page, await createGoogleUser());
  await page.goto(path);
  await page.locator(MOBILE_NAV).waitFor({ state: "attached", timeout: 20_000 });
  await expect(page.getByRole("status", { name: "Đang tải dữ liệu" })).toHaveCount(0, { timeout: 20_000 });
}

/** Horizontal overflow of the document plus visible elements that stick out of the viewport. */
export function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const insideScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };
    const offenders = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && (r.right > vw + 1 || r.left < -1) && !insideScroller(el);
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
    return { scrollOverflow: document.documentElement.scrollWidth - vw, offenders };
  });
}
