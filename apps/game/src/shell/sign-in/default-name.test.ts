import { describe, expect, it } from "vitest";

import { defaultNameCandidates } from "./default-name";

describe("a new account's default names", () => {
  it("keeps the suggestion with what the name rule refuses taken out, then numbers it", () => {
    expect(defaultNameCandidates("maelis.devcon+1")).toEqual([
      "maelisdevcon1",
      "maelisdevcon12",
      "maelisdevcon13",
      "maelisdevcon14",
      "maelisdevcon15",
    ]);
  });

  it("stays within the name's length, numbered forms included", () => {
    const names = defaultNameCandidates("Aelinor of the Western Marches");
    expect(names[0]).toBe("Aelinor of the Weste");
    expect(names[1]).toBe("Aelinor of the West2");
    expect(names.every((name) => name.length <= 20)).toBe(true);
  });

  it("falls back to the game's default name when the suggestion is too short to keep", () => {
    expect(defaultNameCandidates("a.")).toEqual(["Wanderer", "Wanderer2", "Wanderer3", "Wanderer4", "Wanderer5"]);
    expect(defaultNameCandidates(null)[0]).toBe("Wanderer");
  });
});
