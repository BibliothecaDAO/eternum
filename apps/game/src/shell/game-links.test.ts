// @vitest-environment node
import { pushGameName } from "@bibliothecadao/notifications";
import { GAME_MODE_NAMES, type GameModeName } from "@bibliothecadao/types";
import { expect, it } from "vitest";

import { modeLabel } from "./game-links";
import { ageOf } from "./play/ages";

it("names every mode as its pushes do and as Play's ages do, from the one table of mode names", () => {
  for (const mode of Object.keys(GAME_MODE_NAMES) as GameModeName[]) {
    expect(pushGameName({ mode }), mode).toBe(modeLabel({ mode, preset_id: 1 }));
    expect(ageOf(mode).name, mode).toBe(modeLabel({ mode, preset_id: 1 }));
  }
  // Devcon's season is Frontier in a push, never "Season 0".
  expect(pushGameName({ mode: "frontier" })).toBe("Frontier");
});

it("names a game in a push by no id, even one the directory lists with no mode or no longer lists", () => {
  expect(pushGameName({ mode: null })).toBe("Realms");
  expect(pushGameName(undefined)).toBe("Realms");
  expect(modeLabel({ mode: null, preset_id: 7 })).toBe("Preset 7");
});
