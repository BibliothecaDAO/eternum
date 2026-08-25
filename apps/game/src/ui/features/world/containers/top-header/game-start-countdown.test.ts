import { describe, expect, it } from "vitest";

import { formatGameStartCountdown, shouldShowGameStartCountdown } from "./game-start-countdown";

describe("game start countdown", () => {
  it("stays hidden when no game start timestamp is available", () => {
    expect(shouldShowGameStartCountdown({ gameStartMainAt: null, currentBlockTimestamp: 100 })).toBe(false);
  });

  it("shows before the main phase starts", () => {
    expect(shouldShowGameStartCountdown({ gameStartMainAt: 220, currentBlockTimestamp: 100 })).toBe(true);
  });

  it("hides once the main phase has started", () => {
    expect(shouldShowGameStartCountdown({ gameStartMainAt: 220, currentBlockTimestamp: 220 })).toBe(false);
  });

  it("formats the remaining time for the top nav", () => {
    expect(formatGameStartCountdown(4_328)).toBe("1h 12m 08s");
    expect(formatGameStartCountdown(68)).toBe("1m 08s");
  });
});
