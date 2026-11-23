import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { GameChatConnection } from "@/ui/features/world/containers/hud-chat-window";
import { setActiveGame } from "@/runtime/world/store";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { openShard } from "@bibliothecadao/eternum/shard";
import { type ReactNode, useEffect, useState } from "react";

import { installLabGame, LAB_CHAIN, labGameProfile, PLAYER } from "./fixture-game";
import type { GameType } from "../../../../../../../config/source/common/types";
import { releaseLine } from "../../../../../../../packages/core/src/test-support/releases";

const LAB_SCHEMA = "0xlab";

export const LabGame = ({
  mode,
  spectating = false,
  finished = false,
  facts,
  systemCalls,
  children,
}: {
  mode: GameType;
  spectating?: boolean;
  finished?: boolean;
  /** More of the game a view needs (an army out), read from the installed store. */
  facts?: (store: NativeFactStore) => unknown[];
  /** The calls a view proves, standing in for the network's (they record what they were sent), on its store. */
  systemCalls?: (store: NativeFactStore) => Record<string, unknown>;
  children: (store: NativeFactStore) => ReactNode;
}) => {
  const [store] = useState(() => {
    const installed = installLabGame(mode, finished);
    if (facts) installed.applyFacts(facts(installed) as never);
    return installed;
  });
  useState(() => useUIStore.setState({ showBlankOverlay: false, isSpectating: spectating }));
  useLabPlayer();
  const shardOpen = useLabShard();
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

const useLabShard = () => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void openShard("https://127.0.0.1:1", LAB_SCHEMA, undefined, {
      version: 1,
      chainId: LAB_CHAIN,
      releases: releaseLine(LAB_SCHEMA, [1]),
      rpcUrl: "https://127.0.0.1:1/rpc",
      accountClassHash: "0x1",
      contracts: { games: "0x1" },
      guardianPublicKey: "0x1",
      l2GasBound: "0x1",
    }).then(() => {
      setActiveGame(labGameProfile());
      setOpen(true);
    });
  }, []);
  return open;
};
