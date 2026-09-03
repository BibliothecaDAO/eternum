import { describe, expect, it } from "vitest";

import { CameraView } from "./camera-view";
import {
  EMPTY_LABEL_PRIORITY_CONTEXT,
  normalizeOwnerAddress,
  resolveWorldmapContentLadder,
  shouldShowTextLabel,
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
      biomeUnderlay: true,
      structureModels: true,
      armyModels: true,
      // Legacy army models are the one representation while the procedural characters are iterated on.
      proceduralCharacters: false,
      fx: true,
      textLabels: "full",
      entityIcons: false,
    });
    expect(resolveWorldmapContentLadder(CameraView.Medium)).toMatchObject({
      biomeUnderlay: true,
      structureModels: true,
      proceduralCharacters: false,
      textLabels: "priority",
      entityIcons: false,
      armyTierGlyphs: true,
    });
    expect(resolveWorldmapContentLadder(CameraView.Far)).toMatchObject({
      biomeUnderlay: true,
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

  it("normalises owner addresses across bigint and hex string forms", () => {
    expect(normalizeOwnerAddress(0xabcn)).toBe("abc");
    expect(normalizeOwnerAddress("0x0ABC")).toBe("abc");
    expect(normalizeOwnerAddress(undefined)).toBeNull();
  });
});
