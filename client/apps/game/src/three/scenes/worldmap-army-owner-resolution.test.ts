import { describe, expect, it } from "vitest";
import { resolveArmyOwnerCacheAction } from "./worldmap-army-owner-resolution";

// Behavioral coverage for the owner→cache-action decision that updateArmyHexes
// makes before touching the spatial/clickability cache. A real (non-zero) owner
// is always authoritative; a 0n owner means "defeated/deleted OR not-yet-synced"
// and is resolved against the existing cache (for a known army) or the ECS
// fallback (for a brand-new army), never persisted as-is.

const OWNER_A = 0xa11cen;
const OWNER_B = 0xb0bn;

describe("resolveArmyOwnerCacheAction", () => {
  it("writes the incoming owner when it is non-zero (authoritative)", () => {
    const action = resolveArmyOwnerCacheAction({
      ownerAddress: OWNER_A,
      isAlreadyCached: false,
    });
    expect(action).toEqual({ kind: "write", owner: OWNER_A });
  });

  it("writes the incoming owner even when the army is already cached", () => {
    const action = resolveArmyOwnerCacheAction({
      ownerAddress: OWNER_A,
      isAlreadyCached: true,
      cachedOwner: OWNER_B,
    });
    expect(action).toEqual({ kind: "write", owner: OWNER_A });
  });

  it("preserves a cached non-zero owner when an already-cached army reports 0n", () => {
    const action = resolveArmyOwnerCacheAction({
      ownerAddress: 0n,
      isAlreadyCached: true,
      cachedOwner: OWNER_B,
    });
    expect(action).toEqual({ kind: "write", owner: OWNER_B });
  });

  it("evicts an already-cached army whose owner is 0n with no recoverable cached owner", () => {
    const action = resolveArmyOwnerCacheAction({
      ownerAddress: 0n,
      isAlreadyCached: true,
      cachedOwner: undefined,
    });
    expect(action).toEqual({ kind: "evict" });
  });

  it("evicts an already-cached army when even the cached owner is 0n", () => {
    const action = resolveArmyOwnerCacheAction({
      ownerAddress: 0n,
      isAlreadyCached: true,
      cachedOwner: 0n,
    });
    expect(action).toEqual({ kind: "evict" });
  });

  it("writes an ECS-resolved owner for a new army that reported 0n", () => {
    const action = resolveArmyOwnerCacheAction({
      ownerAddress: 0n,
      isAlreadyCached: false,
      ecsResolvedOwner: OWNER_A,
    });
    expect(action).toEqual({ kind: "write", owner: OWNER_A });
  });

  it("skips the cache write for a new army whose 0n owner stays unresolved", () => {
    const action = resolveArmyOwnerCacheAction({
      ownerAddress: 0n,
      isAlreadyCached: false,
      ecsResolvedOwner: undefined,
    });
    expect(action).toEqual({ kind: "skip" });
  });

  it("skips when the ECS fallback itself resolved to 0n (lookup found a zero owner)", () => {
    const action = resolveArmyOwnerCacheAction({
      ownerAddress: 0n,
      isAlreadyCached: false,
      ecsResolvedOwner: 0n,
    });
    expect(action).toEqual({ kind: "skip" });
  });
});
