import { describe, expect, it } from "vitest";
import { nativePresetIdFor } from "../../../config/source/native";
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

  it("defaults an absent version to 2 and stamps a default game start time", () => {
    const result = applyDurableLaunchDefaults(gameRequest(false), 0);
    expect(result.version).toBe("2");
    expect("gameStartTime" in result && result.gameStartTime).toBeTruthy();
  });
});

it("selects the Frontier preset and rejects cross-mode presets", () => {
  const request: CreateGameRequest = { environment: "madara.frontier", gameName: "frontier-test", devModeOn: false };
  expect(applyDurableLaunchDefaults(request).version).toBe(String(nativePresetIdFor("frontier")));
  expect(() => applyDurableLaunchDefaults({ ...request, version: "2" })).toThrow();
  expect(() => applyDurableLaunchDefaults({ ...gameRequest(), version: "5" })).toThrow();
});

it("rejects reserved names at the durable queue boundary, including slot-derived games", () => {
  expect(() => applyDurableLaunchDefaults({ environment: "madara.blitz", gameName: "check-hidden-1" })).toThrow(
    "reserved",
  );
});
