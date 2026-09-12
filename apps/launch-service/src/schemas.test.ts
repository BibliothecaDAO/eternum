import { describe, expect, it } from "vitest";
import { applyDurableLaunchDefaults, type CreateGameRequest } from "./schemas";

const gameRequest = (devModeOn?: boolean, version?: "2" | "3"): CreateGameRequest => ({
  environment: "madara.blitz",
  gameName: "bltz-test",
  ...(devModeOn === undefined ? {} : { devModeOn }),
  ...(version === undefined ? {} : { version }),
});

describe("applyDurableLaunchDefaults", () => {
  it("keeps a real game's devModeOn:false instead of forcing dev mode on", () => {
    expect(applyDurableLaunchDefaults("game", gameRequest(false)).devModeOn).toBe(false);
  });

  it("keeps a Sandbox game's devModeOn:true", () => {
    expect(applyDurableLaunchDefaults("game", gameRequest(true)).devModeOn).toBe(true);
  });

  it("defaults an absent version to 8 and stamps a default game start time", () => {
    const result = applyDurableLaunchDefaults("game", gameRequest(false), 0);
    expect(result.version).toBe("2");
    expect("gameStartTime" in result && result.gameStartTime).toBeTruthy();
  });

  it("keeps a Duel launch version 9 instead of forcing the default", () => {
    expect(applyDurableLaunchDefaults("game", gameRequest(false, "3")).version).toBe("3");
  });
});

it("selects the Eternum preset and rejects cross-mode presets", () => {
  const request: CreateGameRequest = { environment: "madara.eternum", gameName: "eternum-test", devModeOn: false };
  expect(applyDurableLaunchDefaults("game", request).version).toBe("1");
  expect(() => applyDurableLaunchDefaults("game", { ...request, version: "2" })).toThrow();
  expect(() => applyDurableLaunchDefaults("game", { ...gameRequest(), version: "1" })).toThrow();
});
