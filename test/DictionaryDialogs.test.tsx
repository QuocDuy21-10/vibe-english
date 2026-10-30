// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/routes/AppDataProvider", () => ({
  useAuth: () => ({ user: { uid: "user-1" } }),
  useVocabularyData: () => ({ topics: [], vocabularies: [] })
}));

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

  it("preloads and opens the add dialog from pointer intent", async () => {
    mocks.addModuleLoads = 0;
    mocks.importModuleLoads = 0;

    const { DictionaryPage } = await import("@/pages/DictionaryPage");
    render(<DictionaryPage />);
    const trigger = screen.getByRole("button", { name: /^Thêm từ mới Thêm từ$/ });

    fireEvent.pointerEnter(trigger);
    await waitFor(() => expect(mocks.addModuleLoads).toBe(1));
    fireEvent.click(trigger);

    expect((await screen.findAllByText("Add dialog body")).length).toBeGreaterThanOrEqual(1);
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
