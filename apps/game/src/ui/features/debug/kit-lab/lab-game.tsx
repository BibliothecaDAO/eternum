import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { saveGameProfile, setActiveGame } from "@/runtime/world/store";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { openShard } from "@bibliothecadao/eternum/shard";
import { type ReactNode, useEffect, useState } from "react";

import presetRules from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { installFixtureGame, PLAYER } from "./fixture-game";

/** The lab game's chain: a shard at an address that answers nothing, so every history read fails as an offline one. */
const LAB_CHAIN = "0x1ab";
const LAB_SCHEMA = "0xlab";

/**
 * Dev only: the fixture game the HUD labs play, mounted as the game mounts it, so the HUD's own components (the top
 * bar, the rail's Next up, events and chat, the minimap) draw on it: the game's mode (its preset), whether the viewer
 * watches, and whether the game has ended. Its history reads go to a shard that answers nothing, so the panels show
 * what they show without history.
 */
export const LabGame = ({
  preset,
  spectating = false,
  finished = false,
  children,
}: {
  preset: number;
  spectating?: boolean;
  finished?: boolean;
  children: (store: NativeFactStore) => ReactNode;
}) => {
  const [store] = useState(() => installLabGame(preset, finished));
  useState(() => useUIStore.setState({ showBlankOverlay: false, isSpectating: spectating }));
  useLabPlayer();
  const shardOpen = useLabShard(preset);
  return (
    <GameProvider
      value={{ store, systemCalls: {} } as unknown as GameClientSetup}
      account={{ address: PLAYER } as never}
    >
      {shardOpen && children(store)}
    </GameProvider>
  );
};

/**
 * The fixture's player stays the lab's account while the lab plays: the app's own sign-in runtime clears an account
 * no session holds, which would leave a fresh browser's lab with no player.
 */
const useLabPlayer = () =>
  useEffect(() => {
    const hold = () => {
      if (useAccountStore.getState().account?.address !== PLAYER)
        useAccountStore.setState({ account: { address: PLAYER } as never });
    };
    hold();
    return useAccountStore.subscribe(hold);
  }, []);

const useLabShard = (preset: number) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void openShard("https://127.0.0.1:1", LAB_SCHEMA, undefined, {
      version: 1,
      chainId: LAB_CHAIN,
      releaseSchemas: { lab: LAB_SCHEMA },
      rpcUrl: "https://127.0.0.1:1/rpc",
      accountClassHash: "0x1",
      contracts: { games: "0x1" },
      guardianPublicKey: "0x1",
      l2GasBound: "0x1",
    }).then(() => {
      saveGameProfile({ chainId: LAB_CHAIN, gameId: 1, presetId: preset, name: "Lab", fetchedAt: 0 });
      setActiveGame({ chainId: LAB_CHAIN, gameId: 1 });
      setOpen(true);
    });
  }, [preset]);
  return open;
};

/**
 * The fixture game as the mode plays it (its preset), ended a while ago for a finished game, with what the whole HUD
 * reads that the fixture leaves out: the realm's buildings and population, and the preset's building rules.
 */
const installLabGame = (preset: number, finished: boolean): NativeFactStore => {
  const store = installFixtureGame();
  const registry = store.require("GameRegistry", { game_id: 1 });
  store.applyFacts([
    {
      model: "GameRegistry",
      key: "0x3",
      value: { ...registry, preset_id: preset, ...(finished ? { end_at: "300" } : {}) },
    },
    {
      model: "StructureBuildings",
      key: "0xb7",
      value: {
        game_id: 1,
        entity_id: "7",
        packed_counts_1: "0",
        packed_counts_2: "0",
        packed_counts_3: "0",
        population: { current: 2, max: 6 },
      },
    },
    ...presetRules.buildings.map(({ category, rule }) => ({
      model: "BuildingRule",
      key: `0x6${category}`,
      value: { ...rule, category, game_id: 1 },
    })),
  ] as never);
  return store;
};
