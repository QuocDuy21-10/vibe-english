import { describe, expect, it } from "vitest";
import { buildCloze, pickClozeExample } from "./cloze";

describe("buildCloze", () => {
  it("splits around the first case-insensitive match and keeps the sentence's casing", () => {
    expect(buildCloze("Deployed code is deployed again.", "deployed")).toEqual({
      before: "",
      answer: "Deployed",
      after: " code is deployed again."
    });
  });

  it("handles punctuation next to the answer", () => {
    expect(buildCloze("We finally deployed.", "deployed")).toEqual({
      before: "We finally ",
      answer: "deployed",
      after: "."
    });
  });

  it("returns null when the answer is missing or blank", () => {
    expect(buildCloze("Nothing here.", "deploy")).toBeNull();
    expect(buildCloze("Nothing here.", "  ")).toBeNull();
  });
});

describe("pickClozeExample", () => {
  const examples = [
    { sentence: "No match.", translation: "", answer: "deploy" },
    { sentence: "We deploy daily.", translation: "", answer: "deploy" },
    { sentence: "They deployed it.", translation: "", answer: "deployed" }
  ];

  it("only picks examples that form a cloze, deterministically per key", () => {
    const first = pickClozeExample(examples, "v1:seed");
    expect(first?.example.sentence).not.toBe("No match.");
    expect(pickClozeExample(examples, "v1:seed")).toEqual(first);
  });

  it("returns null when no example is usable", () => {
    expect(pickClozeExample([examples[0]], "k")).toBeNull();
    expect(pickClozeExample([], "k")).toBeNull();
  });
});
