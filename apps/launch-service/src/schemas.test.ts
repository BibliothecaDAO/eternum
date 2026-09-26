import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { applyDurableLaunchDefaults, CreateGameRequestSchema, type CreateGameRequest } from "./schemas";

const gameRequest = (devModeOn?: boolean): CreateGameRequest => ({
  environment: "madara.blitz",
  gameName: "bltz-test",
  ...(devModeOn === undefined ? {} : { devModeOn }),
});

describe("applyDurableLaunchDefaults", () => {
  it("keeps a real game's devModeOn:false instead of forcing dev mode on", () => {
    expect(applyDurableLaunchDefaults("game", gameRequest(false)).devModeOn).toBe(false);
  });

  it("keeps a Sandbox game's devModeOn:true", () => {
    expect(applyDurableLaunchDefaults("game", gameRequest(true)).devModeOn).toBe(true);
  });

  it("defaults an absent version to 2 and stamps a default game start time", () => {
    const result = applyDurableLaunchDefaults("game", gameRequest(false), 0);
    expect(result.version).toBe("2");
    expect("gameStartTime" in result && result.gameStartTime).toBeTruthy();
  });
});

it("selects the Eternum preset and rejects cross-mode presets", () => {
  const request: CreateGameRequest = { environment: "madara.eternum", gameName: "eternum-test", devModeOn: false };
  expect(applyDurableLaunchDefaults("game", request).version).toBe("3");
  expect(() => applyDurableLaunchDefaults("game", { ...request, version: "2" })).toThrow();
  expect(() => applyDurableLaunchDefaults("game", { ...gameRequest(), version: "5" })).toThrow();
});

it("accepts registered Frontier presets and rejects unregistered or cross-mode presets", () => {
  const decode = Schema.decodeUnknownSync(CreateGameRequestSchema);
  expect(decode({ environment: "madara.frontier", gameName: "production", version: "5" }).version).toBe("5");
  expect(decode({ environment: "madara.frontier", gameName: "playtest", version: "103" }).version).toBe("103");
  expect(() => decode({ environment: "madara.frontier", gameName: "unknown", version: "999" })).toThrow();
  expect(() => decode({ environment: "madara.blitz", gameName: "wrong-mode", version: "103" })).toThrow();
  expect(decode({ environment: "madara.blitz", gameName: "blitz", version: "2" }).version).toBe("2");
});
