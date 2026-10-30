import { Color } from "three";
import { describe, expect, it } from "vitest";
import { HUD_SHEET, seatSide } from "@/tokens";
import { armyPathColour } from "./army-path-colour";

const army = (side: { isMine?: boolean; isAlly?: boolean; owner?: bigint }) => ({
  isMine: side.isMine ?? false,
  isAlly: side.isAlly ?? false,
  owner: { address: side.owner ?? 0x5n },
});

describe("an army's path colour", () => {
  it("is its side's, as the map's plates draw it: yours green, an ally's blue, anyone else's red, nobody's too", () => {
    expect(armyPathColour(army({ isMine: true }), null)).toEqual(new Color(HUD_SHEET.own));
    expect(armyPathColour(army({ isAlly: true }), null)).toEqual(new Color(HUD_SHEET.ally));
    expect(armyPathColour(army({}), null)).toEqual(new Color(HUD_SHEET.enemy));
    expect(armyPathColour(army({ owner: 0n }), null)).toEqual(new Color(HUD_SHEET.enemy));
  });

  it("is its owner's seat colour to a watching viewer, whatever the side", () => {
    const seat = seatSide(3);
    expect(armyPathColour(army({ isMine: true }), seat)).toEqual(new Color(seat.colour));
  });
});
