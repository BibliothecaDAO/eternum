import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { saveGameProfile, setActiveGame } from "@/runtime/world/store";
import { bindChainTime } from "@/sync/chain-time-binding";
import { SurfaceHost } from "@/ui/design-system/molecules/popover";
import { FrontierHud } from "@/ui/features/frontier/frontier-hud";
import { useBootDocumentState } from "@/ui/modules/boot-loader/boot-loader-state";
import { BlockTimestampPoller } from "@/ui/shared/components/block-timestamp-poller";
import { configManager, readExpeditionRules } from "@bibliothecadao/eternum";
import { type GameClientSetup, NativeFactStore, openShard } from "@bibliothecadao/eternum/game-client";
import { useEffect, useState } from "react";
import { buildLabDay, LAB_PLAYER, LAB_REALM_ID, loadGeneratedRules } from "./frontier-hud-lab-facts";

type Lab = Awaited<ReturnType<typeof bootLab>>;

/**
 * Dev only: Frontier's HUD over the current Frontier launch's facts, with no chain, identity or scene behind it. Open it at
 * /lab/frontier-hud/map for the expedition, /lab/frontier-hud/hex for the realm.
 */
export const FrontierHudLabView = () => {
  const [lab, setLab] = useState<Lab | null | "missing">(null);
  useBootDocumentState("app-ready");
  useEffect(() => {
    void bootLab().then((booted) => setLab(booted ?? "missing"));
  }, []);

  if (lab === "missing") return <p className="p-6 font-sans text-gold">Run `pnpm lab:frontier` in apps/game first.</p>;
  if (!lab) return null;
  return (
    <GameProvider value={lab.setup} account={lab.account as never}>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,#2c3b2a,#0c0a08)]" />
      <BlockTimestampPoller />
      <SurfaceHost />
      <FrontierHud rules={readExpeditionRules(lab.setup.store, lab.gameId)!} />
      <LabPacing store={lab.setup.store} gameId={lab.gameId} />
    </GameProvider>
  );
};

/** The launch's own clock, stated so nobody reads an accelerated launch as Frontier's real pacing. */
const LabPacing = ({ store, gameId }: { store: NativeFactStore; gameId: number }) => {
  const rules = store.require("SliceRules", { game_id: gameId });
  return (
    <p className="pointer-events-none fixed top-36 left-1/2 z-40 -translate-x-1/2 rounded bg-black/70 px-2 py-1 font-sans text-[10px] text-gold/80">
      Lab · launch pacing: {rules.epoch_seconds} s days, {String(rules.tick_config.armies_tick_in_seconds)} s ticks, +
      {rules.troop_stamina_config.stamina_gain_per_tick} stamina a tick
    </p>
  );
};

const LAB_SHARD_URL = "https://lab-shard.invalid";
const LAB_CHAIN_ID = "0x4c4142";
const LAB_SCHEMA = "lab";

const bootLab = async () => {
  const rules = await loadGeneratedRules();
  if (!rules) return null;
  const day = buildLabDay(rules);
  await openLabShard(day.gameId);
  const store = new NativeFactStore();
  store.applyFacts(day.facts as never);
  // The whole day is in the store, so sparse facts are declared zeros, as after Herald's completed snapshot.
  store.setSnapshot({ gameId: day.gameId, complete: true, actor: LAB_PLAYER, timestamp: day.nowSeconds });
  configManager.setActiveGame(day.gameId, 5);
  configManager.setStore(store);
  bindChainTime();
  useChainTimeStore.getState().anchor({ timestamp: day.nowSeconds * 1000, source: "lab" });
  const account = { address: LAB_PLAYER };
  useAccountStore.setState({ account: account as never });
  useUIStore.setState({ showBlankOverlay: false, structureEntityId: LAB_REALM_ID });
  // The realm view opens on the castle's plot, so its panel shows.
  if (window.location.pathname.includes("/hex"))
    useUIStore.getState().setSelectedBuildingHex({ structureId: LAB_REALM_ID, innerCol: 10, innerRow: 10 });
  const refuse = () => Promise.reject(new Error("The Frontier HUD lab has no chain"));
  const systemCalls = new Proxy({}, { get: () => refuse });
  return { setup: { store, systemCalls } as unknown as GameClientSetup, account, gameId: day.gameId };
};

/** The lab's shard answers from memory: a manifest naming the lab chain, and an empty event history. */
const openLabShard = async (gameId: number) => {
  const fetchNetwork = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(LAB_SHARD_URL)) return fetchNetwork(input, init);
    const body = url.includes("/manifest")
      ? {
          version: 1,
          chainId: LAB_CHAIN_ID,
          releaseSchemas: { "1": LAB_SCHEMA },
          rpcUrl: LAB_SHARD_URL,
          admissionUrl: LAB_SHARD_URL,
          accountClassHash: "0x1",
          guardianPublicKey: "0x1",
          contracts: { games: "0x1" },
        }
      : { complete_through_block: 0, items: [], limit: 0, offset: 0, total: 0 };
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  };
  await openShard(LAB_SHARD_URL, LAB_SCHEMA);
  const game = { chainId: LAB_CHAIN_ID, gameId };
  saveGameProfile({ ...game, presetId: 5, name: "Frontier lab", fetchedAt: 0 });
  setActiveGame(game);
};
