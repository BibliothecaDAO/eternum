import { describe, expect, it } from "vitest";
import { shouldUseWorkerPathForArmy } from "./army-movement-path-strategy";

describe("shouldUseWorkerPathForArmy", () => {
  it("uses the worker pathfinder for player-owned movement", () => {
    expect(shouldUseWorkerPathForArmy({ isMine: true })).toBe(true);
  });

  it("skips the worker pathfinder for foreign movement trails", () => {
    expect(shouldUseWorkerPathForArmy({ isMine: false })).toBe(false);
  });
});
