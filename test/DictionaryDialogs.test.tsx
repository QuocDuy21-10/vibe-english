// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addModuleLoads: 0,
  importModuleLoads: 0,
  reload: vi.fn()
}));

vi.mock("@/components/features/AddVocabDialog", () => {
  mocks.addModuleLoads += 1;
  return { AddVocabDialog: () => <div>Add dialog body</div> };
});
vi.mock("@/components/features/ImportVocabDialog", () => {
  mocks.importModuleLoads += 1;
  return { ImportVocabDialog: () => <div>Import dialog body</div> };
});

import { LazyDialogBoundary } from "@/components/features/LazyDialogBoundary";

afterEach(() => {
  vi.clearAllMocks();
});

describe("dictionary dialog module boundaries", () => {
  it("does not load add or import dialog modules while importing the page", async () => {
    mocks.addModuleLoads = 0;
    mocks.importModuleLoads = 0;
    vi.resetModules();

    await import("@/pages/DictionaryPage");

    expect(mocks.addModuleLoads).toBe(0);
    expect(mocks.importModuleLoads).toBe(0);
  });

  it("shows a reload recovery action when a lazy dialog fails", () => {
    function BrokenDialog(): ReactNode {
      throw new Error("chunk unavailable");
    }

    render(
      <LazyDialogBoundary reload={mocks.reload}>
        <BrokenDialog />
      </LazyDialogBoundary>
    );

    expect(screen.getByText("Không thể tải hộp thoại. Vui lòng thử lại.")).toBeTruthy();
    screen.getByRole("button", { name: "Tải lại" }).click();
    expect(mocks.reload).toHaveBeenCalledTimes(1);
  });
});
