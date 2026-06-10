import { ActionType } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";
import { resolveSelectionHighlightColor } from "./selection-highlight-colors";

describe("resolveSelectionHighlightColor", () => {
  it("returns a highlight color for every action type", () => {
    for (const actionType of Object.values(ActionType)) {
      expect(resolveSelectionHighlightColor(actionType)).toBeDefined();
    }
  });
});
