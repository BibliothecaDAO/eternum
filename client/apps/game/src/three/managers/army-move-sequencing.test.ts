import { describe, expect, it } from "vitest";
import { clearArmyMoveRequest, registerArmyMoveRequest, shouldApplyArmyMoveRequest } from "./army-move-sequencing";

describe("army-move-sequencing", () => {
  it("invalidates older move requests when a newer one is registered", () => {
    const requestByEntity = new Map<number, number>();
    const entityId = 77;

    const firstRequest = registerArmyMoveRequest(requestByEntity, entityId);
    const secondRequest = registerArmyMoveRequest(requestByEntity, entityId);

    expect(firstRequest).toBe(1);
    expect(secondRequest).toBe(2);
    expect(shouldApplyArmyMoveRequest(requestByEntity, entityId, firstRequest)).toBe(false);
    expect(shouldApplyArmyMoveRequest(requestByEntity, entityId, secondRequest)).toBe(true);
  });

  it("clears request tracking for removed armies", () => {
    const requestByEntity = new Map<number, number>();
    const entityId = 88;
    const request = registerArmyMoveRequest(requestByEntity, entityId);

    clearArmyMoveRequest(requestByEntity, entityId);

    expect(shouldApplyArmyMoveRequest(requestByEntity, entityId, request)).toBe(false);
  });
});
