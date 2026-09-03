import { describe, expect, it } from "vitest";
import { applyDurableLaunchDefaults, type CreateGameRequest } from "./schemas";

const gameRequest = (devModeOn?: boolean, version?: "8" | "9"): CreateGameRequest => ({
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
    expect(result.version).toBe("8");
    expect("gameStartTime" in result && result.gameStartTime).toBeTruthy();
  });

  it("keeps a Duel launch version 9 instead of forcing the default", () => {
    expect(applyDurableLaunchDefaults("game", gameRequest(false, "9")).version).toBe("9");
  });
});
