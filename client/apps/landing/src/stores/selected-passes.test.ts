import { describe, expect, it } from "vitest";
import { createSelectedPassesStore } from "./selected-passes";

const token = (id: string) =>
  ({
    token_id: id,
    best_price_hex: null,
  }) as any;

describe("selected-passes store", () => {
  it("replaces selection in one operation", () => {
    const store = createSelectedPassesStore();
    store.getState().replaceSelection([token("1"), token("2")]);
    expect(store.getState().selectedPasses.map((p) => p.token_id)).toEqual(["1", "2"]);
  });

  it("removes many token ids in one operation", () => {
    const store = createSelectedPassesStore();
    store.getState().replaceSelection([token("1"), token("2"), token("3")]);
    store.getState().removeSelection(["1", "3"]);
    expect(store.getState().selectedPasses.map((p) => p.token_id)).toEqual(["2"]);
  });
});
