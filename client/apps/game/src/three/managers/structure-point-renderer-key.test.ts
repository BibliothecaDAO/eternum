import { describe, expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/types", () => ({
  StructureType: {
    Village: 1,
    Realm: 2,
    Hyperstructure: 3,
    Bank: 4,
    FragmentMine: 5,
    HolySite: 6,
    Camp: 7,
    BitcoinMine: 8,
  },
}));

const { StructureType } = await import("@bibliothecadao/types");
const { resolveStructurePointRendererKey } = await import("./structure-point-renderer-key");

describe("resolveStructurePointRendererKey", () => {
  it("routes village-like structures through village ownership buckets", () => {
    expect(
      resolveStructurePointRendererKey({
        structureType: StructureType.Camp,
        isMine: false,
        isAlly: true,
      }),
    ).toBe("allyVillage");
  });

  it("routes holy sites through the hyperstructure marker bucket", () => {
    expect(
      resolveStructurePointRendererKey({
        structureType: StructureType.HolySite,
        isMine: false,
        isAlly: false,
      }),
    ).toBe("hyperstructure");
  });

  it("routes bitcoin mines through the fragment-mine marker bucket", () => {
    expect(
      resolveStructurePointRendererKey({
        structureType: StructureType.BitcoinMine,
        isMine: false,
        isAlly: false,
      }),
    ).toBe("fragmentMine");
  });
});
