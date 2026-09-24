import { describe, expect, it } from "vitest";
import { nativeEntityId } from "./entity-id";
import fixture from "./entity-id.fixture.json";

describe("nativeEntityId", () => {
  it("derives every id of a real batch receipt as starknet.js does", () => {
    const ids = fixture.inputs.map((felts) => nativeEntityId(felts));
    expect(ids).toEqual(fixture.ids);
  });

  it("refuses an input it cannot hash", () => {
    expect(() => nativeEntityId([])).toThrow("Entity id needs 1 to 64 felts");
    expect(() => nativeEntityId([1n << 256n])).toThrow("Not a felt");
  });
});
