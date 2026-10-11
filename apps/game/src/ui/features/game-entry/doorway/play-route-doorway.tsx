import { configManager } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useLocation } from "react-router-dom";

import type { PlayRouteBootPhase } from "@/game-entry/play-route-boot";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameEntry } from "@/hooks/use-game-entry";
import { parsePlayRoute } from "@/play/navigation/play-route";
import { gamePainting, modeLabel } from "@/shell/game-links";
import { useRequestSignIn } from "@/shell/sign-in/sign-in-route";
import { BootDebugPanel } from "@/ui/modules/boot-loader/boot-debug-panel";

import { doorwayRealmOf } from "./doorway-realm";
import { DoorwayScreen } from "./doorway-screen";
import { type DoorwayAudience, doorwayView } from "./doorway-view";

/**
 * The doorway over the game's route while it boots (design o5): the map booting, then the hand-off to play, the
 * player's own realm shown once the game's store has it. The boot's debug panel (its milestones and the renderer
 * trial) stays for bug reports behind `?logs=1`.
 */
export const PlayRouteDoorway = ({
  phase,
  audience,
  setup,
  accountError,
  retry,
  currentTaskLabel,
}: {
  phase: PlayRouteBootPhase;
  audience: DoorwayAudience;
  setup: GameClientSetup | null;
  accountError: string | null;
  retry: () => void;
  currentTaskLabel: string;
}) => {
  const location = useLocation();
  const route = parsePlayRoute(location);
  const requestSignIn = useRequestSignIn();
  const entry = useRouteGame(route);
  const realm = useOwnRealm(setup, audience);
  const view = doorwayView({ source: "boot", phase, audience, accountError });
  return (
    <DoorwayScreen
      view={view}
      realm={realm}
      title={entry ? modeLabel(entry) : undefined}
      painting={entry ? gamePainting(entry) : undefined}
      // The boot retries its own failures; an account that could not be set up retries the whole entry.
      onRetry={phase === "error" ? retry : () => window.location.reload()}
      onSignIn={() => requestSignIn()}
    >
      {route?.verboseLogs && <BootDebugPanel currentTaskLabel={currentTaskLabel} />}
    </DoorwayScreen>
  );
};

/** The route's game as the directory lists it (cached from the entry), for the doorway's title and painting. */
const useRouteGame = (route: ReturnType<typeof parsePlayRoute>) =>
  useGameEntry(route ?? { chainId: "", gameId: 0 }, { enabled: route !== null, player: null, refetchIntervalMs: 0 })
    .data ?? null;

/** The player's selected structure, once it is their own and the game's store holds it. */
const useOwnRealm = (setup: GameClientSetup | null, audience: DoorwayAudience) => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const isSpectating = useUIStore((state) => state.isSpectating);
  if (!setup || audience === "spectator" || isSpectating || !structureEntityId) return null;
  const structure = setup.store.get("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: structureEntityId,
  });
  return structure ? doorwayRealmOf(structure) : null;
};
