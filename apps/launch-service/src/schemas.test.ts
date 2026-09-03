import { describe, expect, it } from "vitest";
import { applyDurableLaunchDefaults, type CreateGameRequest } from "./schemas";

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

  it("stamps version 6 and a default game start time", () => {
    const result = applyDurableLaunchDefaults("game", gameRequest(false), 0);
    expect(result.version).toBe("6");
    expect("gameStartTime" in result && result.gameStartTime).toBeTruthy();
  });
});
