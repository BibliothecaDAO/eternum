import {
  captureSpectateIntentFromUrl,
  isExplicitSpectateSession,
  overrideSpectateIntent,
} from "@/utils/spectator-session";
import { StructureType } from "@bibliothecadao/types";
import { beforeEach, describe, expect, it } from "vitest";
import {
  countOwnedStructures,
  type IdentityChipInput,
  NO_OWNED_STRUCTURES,
  resolveIdentityChipState,
} from "./identity-chip-state";

const enterPlaySession = (search: string) => {
  window.history.replaceState({}, "", `/play/madara/iron-age/map${search}`);
  captureSpectateIntentFromUrl();
};

const signedInPlayer = (overrides: Partial<IdentityChipInput> = {}): IdentityChipInput => ({
  isExplicitSpectateSession: isExplicitSpectateSession(),
  identity: { status: "signed-in", name: "raschel" },
  gameplayAccount: { address: "0x1234567890abcdef", provisioningError: null },
  playerName: "RASCHEL",
  owned: { structures: 3, realms: 3 },
  standing: { rank: 12, points: 4100 },
  ...overrides,
});

describe("resolveIdentityChipState", () => {
  beforeEach(() => enterPlaySession(""));

  it("an explicit ?spectate=true session is spectating as the signed-in name, with Play when the account owns a structure", () => {
    enterPlaySession("?spectate=true");
    expect(resolveIdentityChipState(signedInPlayer())).toEqual({ kind: "spectating", name: "RASCHEL", canPlay: true });
  });

  it("an anonymous explicit spectator is spectating without a name or Play", () => {
    enterPlaySession("?spectate=true");
    const state = resolveIdentityChipState(
      signedInPlayer({
        identity: { status: "anonymous", name: null },
        gameplayAccount: { address: null, provisioningError: null },
      }),
    );
    expect(state).toEqual({ kind: "spectating", name: null, canPlay: false });
  });

  it("a spectator whose account owns nothing in this game gets no Play", () => {
    enterPlaySession("?spectate=true");
    expect(resolveIdentityChipState(signedInPlayer({ owned: NO_OWNED_STRUCTURES }))).toMatchObject({
      kind: "spectating",
      canPlay: false,
    });
  });

  it("the spectate intent survives in-app navigation stripping the query, and overriding it makes a player", () => {
    enterPlaySession("?spectate=true");
    window.history.replaceState({}, "", "/play/madara/iron-age/hex");
    expect(resolveIdentityChipState(signedInPlayer()).kind).toBe("spectating");

    overrideSpectateIntent(false);
    expect(resolveIdentityChipState(signedInPlayer())).toEqual({
      kind: "player",
      name: "RASCHEL",
      realmCount: 3,
      standing: { rank: 12, points: 4100 },
    });
  });

  it("no session and no spectate intent is signed-out (view only), whatever the gameplay account says", () => {
    const state = resolveIdentityChipState(
      signedInPlayer({
        identity: { status: "anonymous", name: null },
        gameplayAccount: { address: "0x0", provisioningError: null },
      }),
    );
    expect(state).toEqual({ kind: "signed-out" });
  });

  it("a session whose gameplay account is still deploying is connecting, carrying the provisioning error", () => {
    const state = resolveIdentityChipState(
      signedInPlayer({ gameplayAccount: { address: null, provisioningError: "class not declared" }, playerName: null }),
    );
    expect(state).toEqual({ kind: "connecting", name: "raschel", error: "class not declared" });
  });

  it("a session still loading is connecting without a name", () => {
    expect(resolveIdentityChipState(signedInPlayer({ identity: { status: "loading", name: null } }))).toEqual({
      kind: "connecting",
      name: null,
      error: null,
    });
  });

  it("hides a rank that means nothing yet and keeps one backed by points or the top 500", () => {
    expect(resolveIdentityChipState(signedInPlayer({ standing: { rank: 900, points: 0 } }))).toMatchObject({
      standing: null,
    });
    expect(resolveIdentityChipState(signedInPlayer({ standing: { rank: 900, points: 5 } }))).toMatchObject({
      standing: { rank: 900, points: 5 },
    });
    expect(resolveIdentityChipState(signedInPlayer({ standing: { rank: 400, points: 0 } }))).toMatchObject({
      standing: { rank: 400, points: 0 },
    });
  });

  it("names the player from the players slice, then the identity, then the short address", () => {
    expect(resolveIdentityChipState(signedInPlayer({ playerName: null }))).toMatchObject({ name: "raschel" });
    expect(
      resolveIdentityChipState(signedInPlayer({ playerName: null, identity: { status: "signed-in", name: null } })),
    ).toMatchObject({ name: "0x1234…cdef" });
  });
});

describe("countOwnedStructures", () => {
  it("counts the owner's structures and realms straight from the structures slice", () => {
    const owner = 0x1234n;
    const structures = [
      { owner, base: { category: StructureType.Realm } },
      { owner, base: { category: StructureType.Village } },
      { owner: 0x99n, base: { category: StructureType.Realm } },
    ];
    expect(countOwnedStructures(structures, owner)).toEqual({ structures: 2, realms: 1 });
    expect(countOwnedStructures(structures, 0x77n)).toEqual(NO_OWNED_STRUCTURES);
  });
});
