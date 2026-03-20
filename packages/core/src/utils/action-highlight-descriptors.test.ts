import { describe, expect, it } from "vitest";
import { ActionPaths, ActionType } from "./action-paths";
import { resolveActionHighlightDescriptors } from "./action-highlight-descriptors";

describe("resolveActionHighlightDescriptors", () => {
  it("preserves endpoint and shared-route meaning when deduping by hex key", () => {
    const feltCenter = 100;
    const origin = { col: feltCenter, row: feltCenter };

    const descriptors = resolveActionHighlightDescriptors(
      [
        [
          { hex: origin, actionType: ActionType.Move },
          { hex: { col: feltCenter + 1, row: feltCenter }, actionType: ActionType.Move },
        ],
        [
          { hex: origin, actionType: ActionType.Move },
          { hex: { col: feltCenter + 1, row: feltCenter }, actionType: ActionType.Move },
          { hex: { col: feltCenter + 2, row: feltCenter }, actionType: ActionType.Move },
        ],
        [
          { hex: origin, actionType: ActionType.Move },
          { hex: { col: feltCenter + 1, row: feltCenter }, actionType: ActionType.Move },
          { hex: { col: feltCenter + 1, row: feltCenter + 1 }, actionType: ActionType.Explore },
        ],
      ],
      feltCenter,
    );

    expect(descriptors).toEqual([
      {
        hex: { col: 1, row: 0 },
        actionType: ActionType.Move,
        kind: "destination",
        isEndpoint: true,
        isSharedRoute: true,
        pathDepth: 1,
      },
      {
        hex: { col: 2, row: 0 },
        actionType: ActionType.Move,
        kind: "destination",
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 2,
      },
      {
        hex: { col: 1, row: 1 },
        actionType: ActionType.Explore,
        kind: "frontier",
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 2,
      },
    ]);
  });

  it.each([
    [ActionType.Attack, "attack"],
    [ActionType.Help, "support"],
    [ActionType.Chest, "chest"],
    [ActionType.CreateArmy, "create-army"],
  ] as const)("maps %s endpoints to the %s highlight kind", (actionType, kind) => {
    const feltCenter = 100;

    expect(
      resolveActionHighlightDescriptors(
        [
          [
            { hex: { col: feltCenter, row: feltCenter }, actionType: ActionType.Move },
            { hex: { col: feltCenter + 1, row: feltCenter }, actionType },
          ],
        ],
        feltCenter,
      ),
    ).toEqual([
      {
        hex: { col: 1, row: 0 },
        actionType,
        kind,
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 1,
      },
    ]);
  });

  it("keeps ActionPaths.getHighlightedHexes stable while descriptor metadata expands", () => {
    const paths = Object.assign(Object.create(ActionPaths.prototype) as ActionPaths, {
      paths: new Map<string, Array<{ hex: { col: number; row: number }; actionType: ActionType }>>(),
      FELT_CENTER: 100,
    });
    const origin = { col: 100, row: 100 };

    paths.set("101,100", [
      { hex: origin, actionType: ActionType.Move },
      { hex: { col: 101, row: 100 }, actionType: ActionType.Move },
    ]);
    paths.set("101,101", [
      { hex: origin, actionType: ActionType.Move },
      { hex: { col: 101, row: 100 }, actionType: ActionType.Move },
      { hex: { col: 101, row: 101 }, actionType: ActionType.Explore },
    ]);

    expect(paths.getHighlightDescriptors()).toEqual([
      {
        hex: { col: 1, row: 0 },
        actionType: ActionType.Move,
        kind: "destination",
        isEndpoint: true,
        isSharedRoute: true,
        pathDepth: 1,
      },
      {
        hex: { col: 1, row: 1 },
        actionType: ActionType.Explore,
        kind: "frontier",
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 2,
      },
    ]);

    expect(paths.getHighlightedHexes()).toEqual([
      {
        hex: { col: 1, row: 0 },
        actionType: ActionType.Move,
      },
      {
        hex: { col: 1, row: 1 },
        actionType: ActionType.Explore,
      },
    ]);
  });
});
