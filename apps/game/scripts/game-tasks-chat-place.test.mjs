import { describe, expect, it } from "vitest";
import { chatPlaceOpened, GAME_TASKS } from "./game-tasks.mjs";

const at = (col, row) => ({ col, row });
const REALM = { id: 7, owner: "0x7", realm: true, ownedByViewer: true };
const OTHER_REALM = { id: 9, owner: "0x7", realm: true, ownedByViewer: true };
const REALM_HEX = at(40, 12);
const sentRealm = { key: "0x1ab:1/structure:7", here: true, opens: true };

/** The reading where the place is pressed: the realm still selected on a desktop, the camera dragged off it. */
const before = {
  phone: false,
  chatShown: true,
  sent: sentRealm,
  structure: REALM,
  army: null,
  hex: REALM_HEX,
  camera: at(20, 30),
  layer: false,
};
/** After the press: the realm selected, the camera on it. */
const after = { ...before, sent: null, camera: REALM_HEX };

describe("the chat-place task", () => {
  it("is a game task whose last press is the place in the message this run sent", () => {
    const task = GAME_TASKS["chat-place"];
    expect(task.expect).toBe(chatPlaceOpened);
    expect(task.presses.at(-1)).toMatchObject({ name: "the place in the message sent", inside: "[data-place-key]" });
    expect(task.presses.at(-1).having("chat-place-x1")).toBe("chat-place-x1");
    expect(task.presses.find((press) => press.fill).value("chat-place-x1")).toContain("chat-place-x1");
    // The reading looks for that same token.
    expect(task.reading("chat-place-x1")).toContain('"chat-place-x1"');
  });

  it("passes when pressing the place sent brings the camera from elsewhere onto that very realm, selected", () => {
    expect(chatPlaceOpened(before, after)).toBe(true);
  });

  it("passes on a phone once its chat page is put away by the press, the map in view", () => {
    const phone = { ...before, phone: true, structure: null, hex: null };
    expect(chatPlaceOpened(phone, { ...after, phone: true, chatShown: false })).toBe(true);
    expect(chatPlaceOpened(phone, { ...after, phone: true, chatShown: true })).toBe(false);
  });

  it("fails when the press changed nothing: the camera was already on the place, or stayed off it", () => {
    expect(chatPlaceOpened({ ...before, camera: REALM_HEX }, after)).toBe(false);
    expect(chatPlaceOpened(before, { ...after, camera: before.camera })).toBe(false);
  });

  it("fails without both camera readings: a start never read is no proof the map moved", () => {
    expect(chatPlaceOpened({ ...before, camera: null }, after)).toBe(false);
    expect(chatPlaceOpened({ ...before, camera: undefined }, after)).toBe(false);
    expect(chatPlaceOpened(before, { ...after, camera: null })).toBe(false);
  });

  it("fails unless the map ends centred on the place's tile, not a hex beside it", () => {
    expect(chatPlaceOpened(before, { ...after, camera: at(41, 12) })).toBe(false);
  });

  it("fails when the chip pressed was another entity's: the map selected what was sent, not what was pressed", () => {
    const otherChip = { ...before, sent: { key: "0x1ab:1/structure:9", here: true, opens: true } };
    expect(chatPlaceOpened(otherChip, after)).toBe(false);
    expect(chatPlaceOpened({ ...before, sent: { key: "0x1ab:1/army:7", here: true, opens: true } }, after)).toBe(false);
  });

  it("fails when the map opened another of the player's realms than the one sent", () => {
    expect(chatPlaceOpened(before, { ...after, structure: OTHER_REALM, hex: at(5, 5), camera: at(5, 5) })).toBe(false);
  });

  it("fails without the message this run sent, or with a place that is struck through or in another game", () => {
    expect(chatPlaceOpened({ ...before, sent: null }, after)).toBe(false);
    expect(chatPlaceOpened({ ...before, sent: { ...sentRealm, opens: false } }, after)).toBe(false);
    expect(chatPlaceOpened({ ...before, sent: { ...sentRealm, here: false } }, after)).toBe(false);
    expect(chatPlaceOpened(null, null)).toBe(false);
  });

  it("reads a site by its tile and layer, and an army by its id", () => {
    const well = { ...before, sent: { key: "0x1ab:1/site:Well@30,30,depth", here: true, opens: true } };
    const onWell = { ...after, structure: null, hex: at(30, 30), camera: at(30, 30), layer: true };
    expect(chatPlaceOpened(well, onWell)).toBe(true);
    expect(chatPlaceOpened(well, { ...onWell, layer: false })).toBe(false);
    expect(chatPlaceOpened(well, { ...onWell, hex: at(31, 33), camera: at(31, 33) })).toBe(false);
    // A tile beside the Well selected, the camera on the Well: the selection is the Well's exact tile, or it is not.
    expect(chatPlaceOpened(well, { ...onWell, hex: at(31, 30), camera: at(30, 30) })).toBe(false);

    const army = { ...before, sent: { key: "0x1ab:1/army:31", here: true, opens: true } };
    const onArmy = { ...after, structure: null, army: { id: 31, hex: at(8, 9), orders: 0 }, camera: at(8, 9) };
    expect(chatPlaceOpened(army, onArmy)).toBe(true);
    expect(chatPlaceOpened(army, { ...onArmy, army: { id: 32, hex: at(8, 9), orders: 0 } })).toBe(false);
  });
});
