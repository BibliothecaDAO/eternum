import { describe, expect, it } from "vitest";
import { applyDurableLaunchDefaults, type CreateGameRequest } from "./schemas";

const gameRequest = (devModeOn?: boolean, version?: "6" | "7"): CreateGameRequest => ({
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

  it("defaults an absent version to 6 and stamps a default game start time", () => {
    const result = applyDurableLaunchDefaults("game", gameRequest(false), 0);
    expect(result.version).toBe("6");
    expect("gameStartTime" in result && result.gameStartTime).toBeTruthy();
  });

  it("keeps a Duel launch's version 7 instead of forcing preset 6", () => {
    expect(applyDurableLaunchDefaults("game", gameRequest(false, "7")).version).toBe("7");
  });
});
