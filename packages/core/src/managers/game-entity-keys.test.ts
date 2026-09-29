import { describe, expect, it } from "vitest";
import { hash } from "starknet";
import { getEntityIdFromKeys } from "./game-entity-keys";

describe("entity identity", () => {
  it("hashes the complete ordered key", () => {
    const keys = [987654321n, 123456789n];
    const expected = hash.computePoseidonHashOnElements(keys);
    expect(getEntityIdFromKeys(keys)).toBe(expected);
    expect(getEntityIdFromKeys([...keys])).toBe(expected);
    expect(getEntityIdFromKeys([...keys].reverse())).not.toBe(expected);
    expect(getEntityIdFromKeys([keys[0]])).not.toBe(expected);
  });
});
