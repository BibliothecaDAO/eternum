import { describe, expect, it } from "vitest";
import { ActionType } from "@bibliothecadao/eternum";
import { isMapPreviewAction } from "./worldmap-action-preview-policy";

describe("map action preview reanchoring", () => {
  it.each([ActionType.Attack, ActionType.Help, ActionType.Chest, ActionType.SpireTravel])("opens a right-click preview for %s", action => {
    expect(isMapPreviewAction(2, action)).toBe(true);
    expect(isMapPreviewAction(0, action)).toBe(false);
  });
  it.each([ActionType.Move, ActionType.Explore, ActionType.CreateArmy, null, undefined])("dismisses instead of submitting %s", action => {
    expect(isMapPreviewAction(2, action)).toBe(false);
  });
});
