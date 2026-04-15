import { describe, expect, it } from "vitest";

import { resolveBlitzSettlementAvailability } from "./game-entry-blitz-timing";

describe("resolveBlitzSettlementAvailability", () => {
  it("keeps settlement locked until the main game timer ends", () => {
    expect(resolveBlitzSettlementAvailability({ startMainAt: 130, nowSec: 100 })).toEqual({
      unlockAtSec: 130,
      isUnlocked: false,
      secondsUntilUnlock: 30,
    });
  });

  it("unlocks settlement exactly when the main game timer ends", () => {
    expect(resolveBlitzSettlementAvailability({ startMainAt: 130, nowSec: 130 })).toEqual({
      unlockAtSec: 130,
      isUnlocked: true,
      secondsUntilUnlock: 0,
    });
  });

  it("stays locked when no unlock timestamp is available", () => {
    expect(resolveBlitzSettlementAvailability({ startMainAt: null, nowSec: 130 })).toEqual({
      unlockAtSec: null,
      isUnlocked: false,
      secondsUntilUnlock: null,
    });
  });
});
