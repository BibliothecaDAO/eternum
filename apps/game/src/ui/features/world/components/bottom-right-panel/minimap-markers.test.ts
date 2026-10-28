import { REALM_SKIN_MODELS, realmSkinIcon, readRealmSkin } from "@/three/structures/realm-skins";
import { shortString } from "starknet";
// @vitest-environment jsdom
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { ContractAddress, RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it } from "vitest";
import { campBeside, SITE } from "@/ui/features/frontier/sites/site-fixture";
import { setActiveGame } from "@/runtime/world";
import { setOpenGameSeats } from "@/utils/entity-ownership";
import { overrideSpectateIntent } from "@/utils/spectator-session";
import { minimapMarkersView } from "./minimap-markers";

afterEach(() => {
  setBlockTimestampSource(null);
  overrideSpectateIntent(false);
  setOpenGameSeats({ chainId: "", gameId: 0 }, []);
});

describe("minimap icon meanings from game facts", () => {
  it("uses the Troll in Frontier and the camp structure in Blitz", () => {
    const { store } = campBeside();
    const game = store.require("GameRegistry", { game_id: 1 });
    for (const [preset, expected] of [
      [5, "beast-troll"],
      [2, "camp"],
    ] as const) {
      store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, preset_id: preset } }]);
      expect(minimapMarkersView.read(store, null).get(String(SITE))?.name).toBe(expected);
    }
  });

  it("changes the realm emblem with its native level while retaining ownership and the value badge", () => {
    const { store } = campBeside();
    const row = store.require("Structure", { game_id: 1, entity_id: 7 });
    for (const level of [0, 1, 2, 3]) {
      store.applyFacts([{ model: "Structure", key: "0x7", value: { ...row, base: { ...row.base, level } } }]);
      expect(minimapMarkersView.read(store, ContractAddress("0x111")).get("7")).toEqual({
        name: `map-realm-${level}`,
        owner: "you",
        value: String(level),
      });
    }
  });
  it("shows ownership, realm level and army strength from the native rows", () => {
    const { store } = campBeside();
    const markers = minimapMarkersView.read(store, ContractAddress("0x111"));
    expect(markers.get("7")).toEqual({ name: "map-realm-0", owner: "you", value: "0" });
    expect(markers.get(String(SITE))).toEqual({ name: "camp", owner: "neutral", value: undefined });
    expect(markers.get("201")).toEqual({ name: "map-army", owner: "you", value: "••" });
    expect(minimapMarkersView.read(store, null).get("201")?.owner).toBe("neutral");
    expect(minimapMarkersView.read(store, ContractAddress("0x222")).get("201")?.owner).toBe("enemy");
  });
  it("updates the badge when troops, a site or guild membership changes", () => {
    const { store } = campBeside();
    const row = store.require("Structure", { game_id: 1, entity_id: SITE });
    const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
    store.applyFacts([
      { model: "Structure", key: "0x71", value: { ...row, base: { ...row.base, category: StructureType.Village } } },
      {
        model: "ExplorerTroops",
        key: "0x74",
        value: { ...army, troops: { ...army.troops, count: 6000n * BigInt(RESOURCE_PRECISION) } },
      },
      { model: "GuildMember", key: "0x81", value: { game_id: 1, actor: 0x111, guild_id: 8 } },
      { model: "GuildMember", key: "0x82", value: { game_id: 1, actor: 0x222, guild_id: 8 } },
    ]);
    const markers = minimapMarkersView.read(store, ContractAddress("0x222"));
    expect(markers.get(String(SITE))?.name).toBe("map-village");
    expect(markers.get("201")).toEqual({ name: "map-army", owner: "ally", value: "•••" });
  });
});

describe("the minimap to a watching viewer (side-colours-4)", () => {
  it("marks each player's things in their seat, nobody's neutral, whatever the viewer's account", () => {
    const { store } = campBeside();
    // The open game's players in the order they joined it: 0x111 holds realm 7 and army 201.
    setActiveGame({ chainId: "SHARD", gameId: 1, presetId: 1, name: "SHARD" });
    setOpenGameSeats({ chainId: "SHARD", gameId: 1 }, [ContractAddress("0x111"), ContractAddress("0x222")]);
    overrideSpectateIntent(true);
    for (const viewer of [null, ContractAddress("0x111"), ContractAddress("0x222")]) {
      const markers = minimapMarkersView.read(store, viewer);
      expect(markers.get("7")?.owner).toBe("seat-0");
      expect(markers.get("201")?.owner).toBe("seat-0");
      expect(markers.get(String(SITE))?.owner).toBe("neutral");
    }
  });
});

it.each(REALM_SKIN_MODELS)(
  "shows $skin level $level on the minimap as CampaignHome arrives and is removed",
  ({ skin, level }) => {
    const { store } = campBeside();
    const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
    store.applyFacts([{ model: "Structure", key: "0x7", value: { ...realm, base: { ...realm.base, level } } }]);
    expect(minimapMarkersView.read(store, null).get("7")?.name).toBe(`map-realm-${level}`);
    store.applyFacts([
      {
        model: "CampaignHome",
        key: "0xc",
        value: {
          game_id: 1,
          home: 7,
          campaign_id: shortString.encodeShortString("devcon-2026"),
          tier: skin === "devcon" ? 1 : 2,
        },
      },
    ]);
    expect(readRealmSkin(store, realm)).toBe(skin);
    expect(minimapMarkersView.read(store, ContractAddress("0x111")).get("7")).toEqual({
      name: realmSkinIcon(skin),
      owner: "you",
      value: String(level),
    });
    store.applyFacts([{ model: "CampaignHome", key: "0xc", value: null }]);
    expect(minimapMarkersView.read(store, null).get("7")?.name).toBe(`map-realm-${level}`);
  },
);
