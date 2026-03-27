import { Coord } from "@bibliothecadao/types";
import { describe, expect, test } from "bun:test";
import {
  buildBankCoordsForMapCenterOffset,
  deriveMapCenterOffsetFromWorldConfigTx,
  resolveMapCenterCoord,
} from "../eternum/banks";

describe("bank placement helpers", () => {
  test("derives map_center_offset from the world config transaction hash", () => {
    expect(deriveMapCenterOffsetFromWorldConfigTx("0x39")).toBe(50);
    expect(deriveMapCenterOffsetFromWorldConfigTx("0x3f")).toBe(60);
  });

  test("builds the bank ring around the resolved map center", () => {
    const mapCenterOffset = 50;
    const center = resolveMapCenterCoord(mapCenterOffset);
    const bankCoords = buildBankCoordsForMapCenterOffset(mapCenterOffset);
    const defaultBankCoords = buildBankCoordsForMapCenterOffset(0);

    expect(center).toEqual(new Coord(2147483596, 2147483596));
    expect(bankCoords).toHaveLength(6);
    expect(bankCoords).toEqual([
      { alt: false, x: 2147483911, y: 2147483596 },
      { alt: false, x: 2147483754, y: 2147483911 },
      { alt: false, x: 2147483439, y: 2147483911 },
      { alt: false, x: 2147483281, y: 2147483596 },
      { alt: false, x: 2147483439, y: 2147483281 },
      { alt: false, x: 2147483754, y: 2147483281 },
    ]);
    expect(bankCoords[0]).not.toEqual(defaultBankCoords[0]);
  });
});
