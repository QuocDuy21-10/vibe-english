import { describe, expect, it } from "vitest";

import { getPaginationModel, getVisiblePageItems } from "@/lib/pagination";

describe("getPaginationModel", () => {
  it("returns a stable empty-list model", () => {
    expect(getPaginationModel(0, 20, 1)).toEqual({
      totalPages: 1,
      currentPage: 1,
      startIndex: 0,
      endIndex: 0,
      pageItems: [1]
    });
  });

  it("clamps a requested page after the item count shrinks", () => {
    expect(getPaginationModel(21, 20, 5)).toMatchObject({
      totalPages: 2,
      currentPage: 2,
      startIndex: 20,
      endIndex: 21
    });
  });

  it("normalizes invalid page and page-size values", () => {
    expect(getPaginationModel(10, 0, -2)).toMatchObject({
      currentPage: 1,
      startIndex: 0,
      endIndex: 1
    });
  });
});

describe("getVisiblePageItems", () => {
  it("returns every page for a short result", () => {
    expect(getVisiblePageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("shows the leading page range", () => {
    expect(getVisiblePageItems(2, 10)).toEqual([1, 2, 3, 4, "ellipsis", 10]);
  });

  it("shows both ellipses around a middle page", () => {
    expect(getVisiblePageItems(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  });

  it("shows the trailing page range", () => {
    expect(getVisiblePageItems(9, 10)).toEqual([1, "ellipsis", 7, 8, 9, 10]);
  });
});
