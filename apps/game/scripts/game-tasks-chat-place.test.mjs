import { expect, it } from "vitest";
import { chatPlaceOpened, GAME_TASKS } from "./game-tasks.mjs";

const OWN_REALM = { id: 7, owner: "0x7", realm: true, ownedByViewer: true };
const opens = { name: "Temtinos", opens: true };
const at = (col, row) => ({ col, row });

it("is a game task, its outcome read where the place is pressed", () => {
  expect(GAME_TASKS["chat-place"].expect).toBe(chatPlaceOpened);
  expect(GAME_TASKS["chat-place"].presses.at(-1).name).toBe("the place in the message sent");
});

it("passes when the place came back opening and the map selected the player's realm, the camera on it", () => {
  const before = { structure: null, hex: null, camera: at(1, 1), chip: opens };
  expect(chatPlaceOpened(before, { structure: OWN_REALM, hex: at(40, 12), camera: at(40, 12), chip: opens })).toBe(
    true,
  );
});

it("fails when the place came back struck through, or the map selected nothing of the player's, or looked elsewhere", () => {
  const after = { structure: OWN_REALM, hex: at(40, 12), camera: at(40, 12), chip: opens };
  expect(chatPlaceOpened({ chip: { ...opens, opens: false } }, after)).toBe(false);
  expect(chatPlaceOpened({ chip: null }, after)).toBe(false);
  expect(chatPlaceOpened({ chip: opens }, { ...after, structure: { ...OWN_REALM, ownedByViewer: false } })).toBe(false);
  expect(chatPlaceOpened({ chip: opens }, { ...after, structure: null })).toBe(false);
  expect(chatPlaceOpened({ chip: opens }, { ...after, camera: at(1, 1) })).toBe(false);
  expect(chatPlaceOpened(null, null)).toBe(false);
});
