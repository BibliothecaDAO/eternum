import { beforeEach, describe, expect, it } from "vitest";
import {
  claimWorldmapInteractionOwner,
  getWorldmapInteractionOwnerInstanceId,
  isWorldmapInteractionOwner,
  releaseWorldmapInteractionOwner,
  resetWorldmapInteractionOwnerForTests,
} from "./worldmap-interaction-owner";

describe("worldmap interaction owner", () => {
  beforeEach(() => {
    resetWorldmapInteractionOwnerForTests();
  });

  it("tracks the most recently claimed owner instance", () => {
    claimWorldmapInteractionOwner(1);
    claimWorldmapInteractionOwner(3);

    expect(getWorldmapInteractionOwnerInstanceId()).toBe(3);
    expect(isWorldmapInteractionOwner(1)).toBe(false);
    expect(isWorldmapInteractionOwner(3)).toBe(true);
  });

  it("releases ownership only for the active owner instance", () => {
    claimWorldmapInteractionOwner(3);

    releaseWorldmapInteractionOwner(1);
    expect(getWorldmapInteractionOwnerInstanceId()).toBe(3);

    releaseWorldmapInteractionOwner(3);
    expect(getWorldmapInteractionOwnerInstanceId()).toBeNull();
  });
});
