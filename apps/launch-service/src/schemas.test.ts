import { describe, expect, it } from "vitest";
import { applyDurableLaunchDefaults, type CreateGameRequest } from "./schemas";

const gameRequest = (devModeOn?: boolean): CreateGameRequest => ({
  environment: "madara.blitz",
  gameName: "bltz-test",
  ...(devModeOn === undefined ? {} : { devModeOn }),
});

describe("applyDurableLaunchDefaults", () => {
  it("keeps a real game's devModeOn:false instead of forcing dev mode on", () => {
    expect(applyDurableLaunchDefaults(gameRequest(false)).devModeOn).toBe(false);
  });

  it("keeps a Sandbox game's devModeOn:true", () => {
    expect(applyDurableLaunchDefaults(gameRequest(true)).devModeOn).toBe(true);
  });

  it("stamps a default game start time", () => {
    const result = applyDurableLaunchDefaults(gameRequest(false), 0);
    expect(result.gameStartTime).toBe(new Date(15 * 60_000).toISOString());
  });
});

it("rejects reserved names at the durable queue boundary, including slot-derived games", () => {
  expect(() => applyDurableLaunchDefaults({ environment: "madara.blitz", gameName: "check-hidden-1" })).toThrow(
    "reserved",
  );
});
