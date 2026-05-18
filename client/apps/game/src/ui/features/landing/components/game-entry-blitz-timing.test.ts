import { describe, expect, it } from "vitest";

import { resolveBlitzSettlementAvailability } from "./game-entry-blitz-timing";

describe("resolveBlitzSettlementAvailability", () => {
  it("keeps settlement locked until registration starts", () => {
    expect(
      resolveBlitzSettlementAvailability({ registrationStartAt: 130, registrationEndAt: 200, nowSec: 100 }),
    ).toEqual({
      unlockAtSec: 130,
      isUnlocked: false,
      secondsUntilUnlock: 30,
    });
  });

  it("unlocks settlement during the registration window", () => {
    expect(
      resolveBlitzSettlementAvailability({ registrationStartAt: 130, registrationEndAt: 200, nowSec: 130 }),
    ).toEqual({
      unlockAtSec: 130,
      isUnlocked: true,
      secondsUntilUnlock: 0,
    });
  });

  it("locks settlement again after registration closes", () => {
    expect(
      resolveBlitzSettlementAvailability({ registrationStartAt: 130, registrationEndAt: 200, nowSec: 205 }),
    ).toEqual({
      unlockAtSec: 130,
      isUnlocked: false,
      secondsUntilUnlock: 0,
    });
  });

  it("keeps settlement unlocked in dev mode", () => {
    expect(
      resolveBlitzSettlementAvailability({
        registrationStartAt: 130,
        registrationEndAt: 200,
        devModeOn: true,
        nowSec: 50,
      }),
    ).toEqual({
      unlockAtSec: 130,
      isUnlocked: true,
      secondsUntilUnlock: 0,
    });
  });

  it("stays locked when no registration window is available", () => {
    expect(
      resolveBlitzSettlementAvailability({ registrationStartAt: null, registrationEndAt: null, nowSec: 130 }),
    ).toEqual({
      unlockAtSec: null,
      isUnlocked: false,
      secondsUntilUnlock: null,
    });
  });
});
