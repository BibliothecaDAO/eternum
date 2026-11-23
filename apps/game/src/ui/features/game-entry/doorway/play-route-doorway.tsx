import { pageNavigation } from "@/utils/page-navigation";
import { configManager } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useMemo, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";

import type { PlayRouteBootPhase } from "@/game-entry/play-route-boot";
import { getCurrentPlayRouteBootToken, usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameEntry } from "@/hooks/use-game-entry";
import { parsePlayRoute } from "@/play/navigation/play-route";
import type { DirectoryGame } from "@/shell/herald";
import { seasonRealmId } from "@/shell/season";
import { resultsHref } from "@/shell/season-tab/results-link";
import { useRequestSignIn } from "@/shell/sign-in/connect";
import { modelPreparationShare, subscribeModelPreparation } from "@/three/model-preparation";
import { BootDebugPanel } from "@/ui/debug/boot-debug-panel";

import { doorwayRealmFromId, doorwayRealmOf, toPaddedFeltAddress } from "./doorway-realm";
import { DoorwayScreen, type DoorwayRealm } from "./doorway-screen";
import { type DoorwayAudience, doorwayView, type GameRefusal } from "./doorway-view";

export const PlayRouteDoorway = ({
  phase,
  audience,
  setup,
  accountError,
  ended,
  refused,
  retry,
  currentTaskLabel,
}: {
  phase: PlayRouteBootPhase;
  audience: DoorwayAudience;
  setup: GameClientSetup | null;
  accountError: string | null;
  ended: boolean;
  refused: GameRefusal | undefined;
  retry: () => void;
  currentTaskLabel: string;
}) => {
  const location = useLocation();
  const route = parsePlayRoute(location);
  const requestSignIn = useRequestSignIn();
  const entry = useRouteGame(route);
  const realm = useOwnRealm(setup, audience, entry);
  const failedScene = usePlayRouteReadinessStore((state) => state.sceneFailure?.scene ?? null);
  const modelShare = useSyncExternalStore(subscribeModelPreparation, modelPreparationShare);
  const view = doorwayView({
    source: "boot",
    phase,
    audience,
    accountError,
    failedScene,
    realmCanOpen: realm !== null,
    ended,
    refused,
    modelShare,
  });
  return (
    <DoorwayScreen
      view={view}
      realm={realm}
      game={entry ?? undefined}
      firstEntry={route?.resumeScene === "hex"}
      onRetry={phase === "error" ? retry : () => pageNavigation.reload()}
      onOpenRealm={openRealmWithoutMap}
      onSignIn={() => requestSignIn()}
      results={route ? resultsHref(route) : undefined}
    >
      <BootDebugPanel currentTaskLabel={currentTaskLabel} />
    </DoorwayScreen>
  );
};

const openRealmWithoutMap = () =>
  usePlayRouteReadinessStore.getState().openRealmWithoutMap(getCurrentPlayRouteBootToken());

const useRouteGame = (route: ReturnType<typeof parsePlayRoute>) => {
  const address = useAccountStore((state) => state.account?.address ?? null);
  const player = useMemo(() => toPaddedFeltAddress(address), [address]);
  return (
    useGameEntry(route ?? { chainId: "", gameId: 0 }, { enabled: route !== null, player, refetchIntervalMs: 0 }).data ??
    null
  );
};

const directoryRealmOf = (entry: Pick<DirectoryGame, "player_state"> | null): DoorwayRealm | null => {
  const realmId = seasonRealmId(entry);
  return realmId !== null ? doorwayRealmFromId(realmId) : null;
};

const useOwnRealm = (
  setup: GameClientSetup | null,
  audience: DoorwayAudience,
  entry: Pick<DirectoryGame, "player_state"> | null,
) => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const isSpectating = useUIStore((state) => state.isSpectating);
  if (audience === "spectator" || isSpectating) return null;
  if (setup && structureEntityId) {
    const structure = setup.store.get("Structure", {
      game_id: configManager.getActiveGameId(),
      entity_id: structureEntityId,
    });
    if (structure) return doorwayRealmOf(structure, setup.store);
  }
  return directoryRealmOf(entry);
};
