// @vitest-environment jsdom
import {
  configManager,
  dayOf,
  readExpeditionRules,
  setBlockTimestampSource,
  setChainProvenTimestampSource,
} from "@bibliothecadao/eternum";
import { ContractAddress, deepSites, RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useFactView } from "@/hooks/use-fact-view";
import { bindChainTime } from "@/sync/chain-time-binding";
import { campBeside, SITE } from "@/ui/features/frontier/sites/site-fixture";
import { setActiveGame } from "@/runtime/world";
import { setOpenGameSeats } from "@/utils/entity-ownership";
import { overrideSpectateIntent } from "@/utils/spectator-session";
import { minimapMarkersView, type MinimapMarker } from "./minimap-markers";
import { deepScenario, HELD_SITE } from "@/lab/game/deep-scenario";
import { wire } from "@/lab/game/lab-chain";
import { DEEP_SITE_MEANINGS } from "@/ui/design-system/domain-icon-meaning";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { GAME_FAMILIES } from "../../../../../../../../config/source/common/native-preset-modes";

afterEach(() => {
  vi.restoreAllMocks();
  setBlockTimestampSource(null);
  setChainProvenTimestampSource(null);
  useAccountStore.setState({ account: null });
  useChainTimeStore.setState({
    lastHeartbeat: null,
    executionFloorMs: null,
    anchorTimestampMs: null,
    anchorPerfMs: null,
    nowMs: null,
  });
  overrideSpectateIntent(false);
  setOpenGameSeats({ chainId: "", gameId: 0 }, []);
});

describe("minimap icon meanings from game facts", () => {
  it("uses the Golem in Frontier and the camp structure in Blitz", () => {
    const { store } = campBeside();
    const game = store.require("GameRegistry", { game_id: 1 });
    for (const [family, expected] of [
      [GAME_FAMILIES.frontier, "beast-golem"],
      [GAME_FAMILIES.blitz, "camp"],
    ] as const) {
      store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, family } }]);
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
        owner: "own",
        value: String(level),
      });
    }
  });
  it("shows ownership, realm level and army strength from the native rows", () => {
    const { store } = campBeside();
    const markers = minimapMarkersView.read(store, ContractAddress("0x111"));
    expect(markers.get("7")).toEqual({ name: "map-realm-0", owner: "own", value: "0" });
    expect(markers.get(String(SITE))).toEqual({ name: "beast-golem", owner: "neutral", value: undefined });
    expect(markers.get("201")).toEqual({ name: "map-army", owner: "own", value: "••" });
    expect(minimapMarkersView.read(store, null).get("201")?.owner).toBe("enemy");
    expect(minimapMarkersView.read(store, ContractAddress("0x222")).get("201")?.owner).toBe("enemy");
  });
  it("updates troops and sites while tribe members remain enemies", () => {
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
    expect(markers.get("201")).toEqual({ name: "map-army", owner: "enemy", value: "•••" });
  });
});

describe("the minimap to a watching viewer (side-colours-4)", () => {
  it("marks each player's things in their seat, nobody's in grey, whatever the viewer's account", () => {
    const { store } = campBeside();
    // The open game's players in the order they joined it: 0x111 holds realm 7 and army 201.
    setActiveGame({ chainId: "SHARD", gameId: 1, name: "SHARD" });
    setOpenGameSeats({ chainId: "SHARD", gameId: 1 }, [ContractAddress("0x111"), ContractAddress("0x222")]);
    overrideSpectateIntent(true);
    for (const viewer of [null, ContractAddress("0x111"), ContractAddress("0x222")]) {
      const markers = minimapMarkersView.read(store, viewer);
      expect(markers.get("7")?.owner).toBe("seat-0");
      expect(markers.get("201")?.owner).toBe("seat-0");
      expect(markers.get(String(SITE))?.owner).toBe("nobody");
    }
  });
});

const [VIEWER, ALLY, RIVAL] = ["0x111", "0x222", "0x333"];
const [VIEWER_ASPECT, RIVAL_ASPECT] = [1, 2];
type DeepKey = (typeof deepSites)[number]["key"];
const siteOf = (key: DeepKey) => deepSites.find((site) => site.key === key)!;
const siteEntity = (key: DeepKey) => BigInt(800 + siteOf(key).id);
const HOLDERS: Record<DeepKey, string> = { foundation: "0x0", core: VIEWER, mine: RIVAL, altar: ALLY };

const deepMinimap = (closedRing = false) => {
  const scenario = deepScenario(closedRing);
  const { store, startsAt } = scenario;
  setBlockTimestampSource(() => startsAt);
  vi.spyOn(configManager, "getTick").mockReturnValue(1);
  const mine = siteEntity("mine");
  const mineSite = store.require("DeepSite", { game_id: 1, entity_id: mine });
  const coreSite = store.require("DeepSite", { game_id: 1, entity_id: siteEntity("core") });
  const mineBeast = store.require("Guard", { game_id: 1, structure_id: mine, slot: 0 });
  store.applyFacts([
    ...deepSites.map((site) => {
      const entity = siteEntity(site.key);
      const existing = store.require("Structure", { game_id: 1, entity_id: entity });
      return {
        model: "Structure" as const,
        key: store.wireKeyOf("Structure", existing)!,
        value: wire({
          ...existing,
          owner: HOLDERS[site.key],
        }),
      };
    }),
    {
      model: "DeepSite",
      key: store.wireKeyOf("DeepSite", mineSite)!,
      value: wire({ ...mineSite, aspect: RIVAL_ASPECT }),
    },
    {
      model: "DeepSite",
      key: store.wireKeyOf("DeepSite", coreSite)!,
      value: wire({ ...coreSite, aspect: VIEWER_ASPECT }),
    },
    {
      model: "Guard",
      key: store.wireKeyOf("Guard", mineBeast)!,
      value: wire({ ...mineBeast, troops: { ...mineBeast.troops, count: 0n } }),
    },
  ] as never);
  return scenario;
};

describe("the Deep's sites on the minimap", () => {
  it("paints every Deep site by its kind and rings it by who holds it today, unclaimed in neutral grey and held-undefended dashed", () => {
    const { store } = deepMinimap();
    const markers = minimapMarkersView.read(store, ContractAddress(VIEWER));
    expect(HELD_SITE).toBe("altar");
    expect(Object.fromEntries(deepSites.map((site) => [site.key, markers.get(String(siteEntity(site.key)))]))).toEqual({
      foundation: { name: DEEP_SITE_MEANINGS.foundation, owner: "nobody", undefended: false, scale: 1.75 },
      core: { name: DEEP_SITE_MEANINGS.core, owner: "own", undefended: true, scale: 1.75 },
      mine: { name: DEEP_SITE_MEANINGS.mine, owner: "enemy", undefended: true, scale: 1.75 },
      altar: { name: DEEP_SITE_MEANINGS.altar, owner: "ally", undefended: false, scale: 1.75 },
    });
  });

  it("clears yesterday's holder on day roll rather than trusting raw Structure.owner", () => {
    const { store, startsAt } = deepMinimap();
    const tomorrow = dayOf(readExpeditionRules(store, 1)!, startsAt)!.end;
    setBlockTimestampSource(() => tomorrow);
    const markers = minimapMarkersView.read(store, ContractAddress(VIEWER));
    for (const site of deepSites) {
      expect(markers.get(String(siteEntity(site.key)))).toEqual({
        name: DEEP_SITE_MEANINGS[site.key],
        owner: "nobody",
        undefended: false,
        scale: 1.75,
      });
    }
  });

  it("marks an army of the viewer's Aspect as an ally, the viewer's own as own", () => {
    const { store } = deepMinimap();
    const markers = minimapMarkersView.read(store, ContractAddress(VIEWER));
    expect(markers.get(String(SPIRE_ARMY))?.owner).toBe("own");
    expect(markers.get("399")?.owner).toBe("ally");
    expect(minimapMarkersView.read(store, ContractAddress(RIVAL)).get("399")?.owner).toBe("enemy");
  });

  it("draws a site whose ring is not open yet as a smaller lock, nobody's", () => {
    const open = minimapMarkersView.read(deepMinimap().store, ContractAddress(VIEWER));
    const markers = minimapMarkersView.read(deepMinimap(true).store, ContractAddress(VIEWER));
    for (const site of deepSites) {
      const locked = markers.get(String(siteEntity(site.key)))!;
      expect(locked).toEqual({ name: "lock", owner: "nobody", scale: 1.45 });
      expect(locked.scale!).toBeLessThan(open.get(String(siteEntity(site.key)))!.scale!);
    }
  });

  it("rings a held site in its holder's seat to a watching viewer, nobody's in grey", () => {
    const { store } = deepMinimap();
    setActiveGame({ chainId: "SHARD", gameId: 1, name: "SHARD" });
    setOpenGameSeats({ chainId: "SHARD", gameId: 1 }, [ContractAddress(VIEWER), ContractAddress(ALLY)]);
    overrideSpectateIntent(true);
    const markers = minimapMarkersView.read(store, null);
    expect(markers.get(String(siteEntity("core")))).toMatchObject({ owner: "seat-0", undefended: true });
    expect(markers.get(String(siteEntity("altar")))).toMatchObject({ owner: "seat-1", undefended: false });
    expect(markers.get(String(siteEntity("foundation")))).toMatchObject({ owner: "nobody", undefended: false });
  });

  it("re-renders live useFactView markers on garrison drain and day rollover in a quiet game with no new facts", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const { store, startsAt } = deepMinimap();
    const altarId = String(siteEntity("altar"));
    const slice = store.require("SliceRules", { game_id: 1 });
    const interval = Number(slice.tick_config.armies_tick_in_seconds);
    const loss = store.require("DeepRules", { game_id: 1 }).loss_per_tick;
    const guard = store.require("Guard", { game_id: 1, structure_id: siteEntity("altar"), slot: 1 });
    const drainTicks = Number((guard.troops.count + loss - 1n) / loss) + 1;
    const drainedAt = startsAt + drainTicks * interval;
    const tomorrow = dayOf(readExpeditionRules(store, 1)!, startsAt)!.end;
    expect(drainedAt).toBeLessThan(tomorrow);

    bindChainTime();
    useChainTimeStore.getState().anchor({ timestamp: startsAt * 1000 });
    const viewerAccount = { address: VIEWER } as never;
    useAccountStore.setState({ account: viewerAccount });

    let latest: Map<string, MinimapMarker> | undefined;
    const Probe = () => {
      latest = useFactView(minimapMarkersView);
      return null;
    };
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const revisionBefore = store.getRevision();
    try {
      await act(async () => {
        root.render(
          createElement(GameProvider, {
            value: { store } as never,
            account: viewerAccount,
            children: createElement(Probe),
          }),
        );
      });
      expect(latest?.get(altarId)).toEqual({
        name: DEEP_SITE_MEANINGS.altar,
        owner: "ally",
        undefended: false,
        scale: 1.75,
      });

      await act(async () => {
        useChainTimeStore.getState().setHeartbeat({ timestamp: drainedAt * 1000 });
      });
      expect(store.getRevision()).toBe(revisionBefore);
      expect(latest?.get(altarId)).toEqual({
        name: DEEP_SITE_MEANINGS.altar,
        owner: "ally",
        undefended: true,
        scale: 1.75,
      });

      await act(async () => {
        useChainTimeStore.getState().setHeartbeat({ timestamp: tomorrow * 1000 });
      });
      expect(store.getRevision()).toBe(revisionBefore);
      expect(latest?.get(altarId)).toEqual({
        name: DEEP_SITE_MEANINGS.altar,
        owner: "nobody",
        undefended: false,
        scale: 1.75,
      });
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
