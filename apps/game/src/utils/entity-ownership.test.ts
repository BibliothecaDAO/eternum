// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: (component: unknown, entity: unknown) => {
    if (component instanceof Map) return component.get(entity);
    return undefined;
  },
}));

vi.mock("@/dojo/game-scope", () => ({
  gameEntityKey: (keys: bigint[]) => keys.map((k) => k.toString()).join(":"),
}));

// Imported after mocks to ensure they take effect.
import { isEntityOwnedByAccount } from "./entity-ownership";

type FakeStructure = { owner: unknown };
const makeComponents = (structures: Record<string, FakeStructure>) =>
  ({
    Structure: new Map<string, FakeStructure>(Object.entries(structures)),
  }) as unknown as Parameters<typeof isEntityOwnedByAccount>[0];

describe("isEntityOwnedByAccount", () => {
  it("returns true when the structure owner matches the account address (case-insensitive, trimmed)", () => {
    const components = makeComponents({ "1": { owner: "0xABC" } });
    expect(isEntityOwnedByAccount(components, 1, "  0xabc  ")).toBe(true);
  });

  it("returns false when the structure has a different owner", () => {
    const components = makeComponents({ "1": { owner: "0xdef" } });
    expect(isEntityOwnedByAccount(components, 1, "0xabc")).toBe(false);
  });

  it("treats padded, unpadded and bigint spellings of one address as equal", () => {
    const components = makeComponents({
      "1": { owner: BigInt("0x7ef0bf1e20711c90929db26f509e78c270edf5a1c14b0287d34377bb9825dbf") },
    });
    expect(
      isEntityOwnedByAccount(components, 1, "0x07ef0bf1e20711c90929db26f509e78c270edf5a1c14b0287d34377bb9825dbf"),
    ).toBe(true);
    expect(
      isEntityOwnedByAccount(components, 1, "0x7ef0bf1e20711c90929db26f509e78c270edf5a1c14b0287d34377bb9825dbf"),
    ).toBe(true);
  });

  it("normalizes bigint owner values to hex", () => {
    const components = makeComponents({ "1": { owner: BigInt("0xabc") } });
    expect(isEntityOwnedByAccount(components, 1, "0xabc")).toBe(true);
  });

  it("normalizes finite number owner values to hex", () => {
    const components = makeComponents({ "1": { owner: 0xabc } });
    expect(isEntityOwnedByAccount(components, 1, "0xabc")).toBe(true);
  });

  it("returns false when the structure is missing", () => {
    const components = makeComponents({});
    expect(isEntityOwnedByAccount(components, 1, "0xabc")).toBe(false);
  });

  it("returns false when the structure has no owner field", () => {
    const components = makeComponents({ "1": { owner: undefined } });
    expect(isEntityOwnedByAccount(components, 1, "0xabc")).toBe(false);
  });

  it("returns false when components is null or undefined", () => {
    expect(isEntityOwnedByAccount(null, 1, "0xabc")).toBe(false);
    expect(isEntityOwnedByAccount(undefined, 1, "0xabc")).toBe(false);
  });

  it("returns false when accountAddress is missing", () => {
    const components = makeComponents({ "1": { owner: "0xabc" } });
    expect(isEntityOwnedByAccount(components, 1, undefined)).toBe(false);
  });

  it("returns false when entityId is 0 or NaN", () => {
    const components = makeComponents({ "0": { owner: "0xabc" } });
    expect(isEntityOwnedByAccount(components, 0, "0xabc")).toBe(false);
    expect(isEntityOwnedByAccount(components, Number.NaN, "0xabc")).toBe(false);
  });

  it("returns false when the owner type is unsupported (e.g. plain object)", () => {
    const components = makeComponents({ "1": { owner: { address: "0xabc" } } });
    expect(isEntityOwnedByAccount(components, 1, "0xabc")).toBe(false);
  });

  it("returns false if getComponentValue throws (e.g. bad BigInt conversion)", () => {
    const components = { Structure: new Map() } as unknown as Parameters<typeof isEntityOwnedByAccount>[0];
    // Passing a non-integer forces BigInt to throw.
    expect(isEntityOwnedByAccount(components, 1.5, "0xabc")).toBe(false);
  });
});
