import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { GameChatConnection } from "@/ui/features/world/containers/hud-chat-window";
import { setActiveGame } from "@/runtime/world/store";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { openShard } from "@bibliothecadao/eternum/shard";
import { type ReactNode, useEffect, useState } from "react";

import { installLabGame, PLAYER } from "./fixture-game";

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
  facts,
  systemCalls,
  children,
}: {
  preset: number;
  spectating?: boolean;
  finished?: boolean;
  /** More of the game a view needs (an army out), read from the installed store. */
  facts?: (store: NativeFactStore) => unknown[];
  /** The calls a view proves, standing in for the network's (they record what they were sent), on its store. */
  systemCalls?: (store: NativeFactStore) => Record<string, unknown>;
  children: (store: NativeFactStore) => ReactNode;
}) => {
  const [store] = useState(() => {
    const installed = installLabGame(preset, finished);
    if (facts) installed.applyFacts(facts(installed) as never);
    return installed;
  });
  useState(() => useUIStore.setState({ showBlankOverlay: false, isSpectating: spectating }));
  useLabPlayer();
  const shardOpen = useLabShard(preset);
  return (
    <GameProvider
      value={{ store, systemCalls: systemCalls?.(store) ?? {} } as unknown as GameClientSetup}
      account={{ address: PLAYER } as never}
    >
      {shardOpen && (
        <>
          <GameChatConnection />
          {children(store)}
        </>
      )}
    </GameProvider>
  );
};

/**
 * The fixture's player stays the lab's account while the lab plays: the app's own sign-in runtime clears an account
 * no session holds, which would leave a fresh browser's lab with no player.
 */
export const useLabPlayer = () =>
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
      setActiveGame({ chainId: LAB_CHAIN, gameId: 1, presetId: preset, name: "Lab" });
      setOpen(true);
    });
  }, [preset]);
  return open;
};
