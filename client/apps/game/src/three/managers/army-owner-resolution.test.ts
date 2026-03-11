import { describe, expect, it } from "vitest";
import { resolveArmyOwnerState } from "./army-owner-resolution";

describe("resolveArmyOwnerState", () => {
  it("preserves existing player owner when incoming owner is temporarily zero", () => {
    const result = resolveArmyOwnerState({
      existingOwner: {
        address: 123n,
        ownerName: "Alice",
        guildName: "Red",
      },
      incomingOwner: {
        address: 0n,
        ownerName: "The Vanguard",
        guildName: "",
      },
    });

    expect(result).toEqual({
      address: 123n,
      ownerName: "Alice",
      guildName: "Red",
    });
  });

  it("keeps known owner name when same-address update has an empty name", () => {
    const result = resolveArmyOwnerState({
      existingOwner: {
        address: 456n,
        ownerName: "Bob",
        guildName: "Blue",
      },
      incomingOwner: {
        address: 456n,
        ownerName: "",
        guildName: "",
      },
    });

    expect(result).toEqual({
      address: 456n,
      ownerName: "Bob",
      guildName: "Blue",
    });
  });

  it("accepts valid incoming owner changes", () => {
    const result = resolveArmyOwnerState({
      existingOwner: {
        address: 456n,
        ownerName: "Bob",
        guildName: "Blue",
      },
      incomingOwner: {
        address: 789n,
        ownerName: "Carol",
        guildName: "Green",
      },
    });

    expect(result).toEqual({
      address: 789n,
      ownerName: "Carol",
      guildName: "Green",
    });
  });

  it("is idempotent when same owner payload repeats", () => {
    const first = resolveArmyOwnerState({
      existingOwner: {
        address: 900n,
        ownerName: "Dawn",
        guildName: "Gold",
      },
      incomingOwner: {
        address: 900n,
        ownerName: "Dawn",
        guildName: "Gold",
      },
    });

    const second = resolveArmyOwnerState({
      existingOwner: first,
      incomingOwner: {
        address: 900n,
        ownerName: "Dawn",
        guildName: "Gold",
      },
    });

    expect(first).toEqual(second);
  });

  it("tracks latest owner across rapid A->B->A transitions", () => {
    const ownerA = {
      address: 111n,
      ownerName: "A",
      guildName: "Alpha",
    };
    const ownerB = {
      address: 222n,
      ownerName: "B",
      guildName: "Beta",
    };

    const afterB = resolveArmyOwnerState({
      existingOwner: ownerA,
      incomingOwner: ownerB,
    });
    const backToA = resolveArmyOwnerState({
      existingOwner: afterB,
      incomingOwner: ownerA,
    });

    expect(afterB).toEqual(ownerB);
    expect(backToA).toEqual(ownerA);
  });
});
