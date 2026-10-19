import { describe, expect, it } from "vitest";

import { CameraView } from "./camera-view";
import {
  EMPTY_LABEL_PRIORITY_CONTEXT,
  normalizeOwnerAddress,
  resolveWorldmapContentLadder,
  shouldShowTextLabel,
  topOwnerAddresses,
} from "./worldmap-content-ladder";

const entity = (overrides: Partial<Parameters<typeof shouldShowTextLabel>[1]> = {}) => ({
  entityId: 7,
  isMine: false,
  isAlly: false,
  ownerAddress: 0xabcn,
  underAttack: false,
  ...overrides,
});

describe("resolveWorldmapContentLadder", () => {
  it("renders everything near, gates text in the mid band and only icons far", () => {
    expect(resolveWorldmapContentLadder(CameraView.Close)).toMatchObject({
      structureModels: true,
      armyModels: true,
      // Legacy army models are the one representation while the procedural characters are iterated on.
      proceduralCharacters: false,
      fx: true,
      textLabels: "full",
      entityIcons: false,
    });
    expect(resolveWorldmapContentLadder(CameraView.Medium)).toMatchObject({
      structureModels: true,
      proceduralCharacters: false,
      textLabels: "priority",
      entityIcons: false,
    });
    expect(resolveWorldmapContentLadder(CameraView.Far)).toMatchObject({
      structureModels: false,
      armyModels: false,
      proceduralCharacters: false,
      fx: false,
      textLabels: "none",
      entityIcons: true,
    });
  });
});

describe("shouldShowTextLabel", () => {
  const top = { ...EMPTY_LABEL_PRIORITY_CONTEXT, topOwnerAddresses: new Set(["abc"]) };

  it("shows every label near and none far", () => {
    expect(shouldShowTextLabel("full", entity(), EMPTY_LABEL_PRIORITY_CONTEXT)).toBe(true);
    expect(shouldShowTextLabel("none", entity({ isMine: true }), EMPTY_LABEL_PRIORITY_CONTEXT)).toBe(false);
  });

  it("keeps own, allied and top-10 labels in the mid band", () => {
    expect(shouldShowTextLabel("priority", entity({ isMine: true }), EMPTY_LABEL_PRIORITY_CONTEXT)).toBe(true);
    expect(shouldShowTextLabel("priority", entity({ isAlly: true }), EMPTY_LABEL_PRIORITY_CONTEXT)).toBe(true);
    expect(shouldShowTextLabel("priority", entity(), top)).toBe(true);
    expect(shouldShowTextLabel("priority", entity({ ownerAddress: 0x1n }), top)).toBe(false);
  });

  it("always labels selected, hovered and under-attack entities, even for spectators", () => {
    const spectator = { ...EMPTY_LABEL_PRIORITY_CONTEXT, isSpectator: true, selectedEntityId: 7 };
    expect(shouldShowTextLabel("priority", entity({ isMine: true, entityId: 8 }), spectator)).toBe(false);
    expect(shouldShowTextLabel("priority", entity(), spectator)).toBe(true);
    expect(shouldShowTextLabel("priority", entity({ entityId: 9, underAttack: true }), spectator)).toBe(true);
    expect(shouldShowTextLabel("priority", entity({ entityId: 9 }), { ...spectator, hoveredEntityId: 9 })).toBe(true);
  });

  it("labels what nobody owns in the mid band, a spectator's too: a hyperstructure, camp or rift the world holds", () => {
    expect(shouldShowTextLabel("priority", entity({ ownerAddress: 0n }), EMPTY_LABEL_PRIORITY_CONTEXT)).toBe(true);
    const spectator = { ...EMPTY_LABEL_PRIORITY_CONTEXT, isSpectator: true };
    expect(shouldShowTextLabel("priority", entity({ ownerAddress: 0n }), spectator)).toBe(true);
    expect(shouldShowTextLabel("none", entity({ ownerAddress: 0n }), EMPTY_LABEL_PRIORITY_CONTEXT)).toBe(false);
  });

  it("normalises owner addresses across bigint and hex string forms", () => {
    expect(normalizeOwnerAddress(0xabcn)).toBe("abc");
    expect(normalizeOwnerAddress("0x0ABC")).toBe("abc");
    expect(normalizeOwnerAddress(undefined)).toBeNull();
  });
});

describe("topOwnerAddresses (the mid band's top ten)", () => {
  it("ranks a player who has scored nothing at 0, never out of the ranking (owner's dev map, 2026-10-19)", () => {
    // The owner scored 150; two other players own realms and have no points row yet.
    const top = topOwnerAddresses([[0xd1n, 150]], [0xd1n, 0xb1n, 0xb2n, 0n], 10);
    expect([...top].toSorted()).toEqual(["b1", "b2", "d1"]);
  });

  it("ranks every owner at 0 while the leaderboard cannot rank yet", () => {
    expect([...topOwnerAddresses([], [0xb1n, 0xb2n], 10)].toSorted()).toEqual(["b1", "b2"]);
  });

  it("keeps the ten with the most points when more players own structures", () => {
    const ranked = Array.from({ length: 12 }, (_, index) => [BigInt(index + 1), 100 - index] as const);
    const top = topOwnerAddresses(ranked, [0xffn], 10);
    expect(top.size).toBe(10);
    expect(top.has("1")).toBe(true);
    expect(top.has("b")).toBe(false);
    expect(top.has("ff")).toBe(false);
  });

  it("is a rule the mid band reads: a ranked owner's things wear their plate", () => {
    const context = { ...EMPTY_LABEL_PRIORITY_CONTEXT, topOwnerAddresses: topOwnerAddresses([], [0xb1n], 10) };
    expect(shouldShowTextLabel("priority", entity({ ownerAddress: 0xb1n }), context)).toBe(true);
  });
});
