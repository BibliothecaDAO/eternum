import { describe, expect, it } from "vitest";
import { resolveAttachedArmyOwnerFromStructure } from "./worldmap-attached-army-owner-sync";

describe("resolveAttachedArmyOwnerFromStructure", () => {
  it("preserves existing owner when incoming structure owner is transient zero", () => {
    const result = resolveAttachedArmyOwnerFromStructure({
      existingArmyOwner: 111n,
      incomingStructureOwner: 0n,
    });

    expect(result).toBe(111n);
  });

  it("accepts a valid structure takeover owner", () => {
    const result = resolveAttachedArmyOwnerFromStructure({
      existingArmyOwner: 111n,
      incomingStructureOwner: 222n,
    });

    expect(result).toBe(222n);
  });

  it("is idempotent when owner remains unchanged", () => {
    const first = resolveAttachedArmyOwnerFromStructure({
      existingArmyOwner: 333n,
      incomingStructureOwner: 333n,
    });
    const second = resolveAttachedArmyOwnerFromStructure({
      existingArmyOwner: first,
      incomingStructureOwner: 333n,
    });

    expect(first).toBe(333n);
    expect(second).toBe(333n);
  });

  it("keeps latest owner across rapid A->B->A transitions", () => {
    const ownerA = 444n;
    const ownerB = 555n;

    const afterB = resolveAttachedArmyOwnerFromStructure({
      existingArmyOwner: ownerA,
      incomingStructureOwner: ownerB,
    });
    const backToA = resolveAttachedArmyOwnerFromStructure({
      existingArmyOwner: afterB,
      incomingStructureOwner: ownerA,
    });

    expect(afterB).toBe(ownerB);
    expect(backToA).toBe(ownerA);
  });
});
