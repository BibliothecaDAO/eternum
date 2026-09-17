import { describe, expect, it, vi } from "vitest";
import { hash } from "starknet";
import { getEntityIdFromKeys } from "./game-entity-keys";

vi.mock("starknet", async (load) => {
  const original = await load<typeof import("starknet")>();
  return {
    ...original,
    hash: { ...original.hash, computePoseidonHashOnElements: vi.fn(original.hash.computePoseidonHashOnElements) },
  };
});

describe("entity identity", () => {
  it("hashes the complete ordered key and reuses the result for equal keys", () => {
    const keys = [987654321n, 123456789n];
    const expected = hash.computePoseidonHashOnElements(keys);
    vi.mocked(hash.computePoseidonHashOnElements).mockClear();
    expect(getEntityIdFromKeys(keys)).toBe(expected);
    expect(getEntityIdFromKeys([...keys])).toBe(expected);
    expect(hash.computePoseidonHashOnElements).toHaveBeenCalledTimes(1);
    expect(getEntityIdFromKeys([...keys].reverse())).not.toBe(expected);
    expect(getEntityIdFromKeys([keys[0]])).not.toBe(expected);
  });
});
