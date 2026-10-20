import { useUIStore, type AppStore } from "@/hooks/store/use-ui-store";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { accountAddress, useAccountStore } from "@/hooks/store/use-account-store";
import { safeInteger, type GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";
import { Position, configManager, structureMapPosition } from "@bibliothecadao/eternum";

import { resetEntryDestination, settleEntryDestination } from "@/game-entry/entry-destination";
import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";

import { followRealmsPlayer, readRealmsPlayer } from "@/shell/herald";

import { resolveInitialStructureSelection } from "../sync/initial-structure-selection";

interface InitialSelectableStructure {
  entity_id: number;
  coord_x: number;
  coord_y: number;
  category: number;
}

const readInitialSelectableStructures = (setup: SetupResult, owner?: bigint): InitialSelectableStructure[] => {
  const gameId = configManager.getActiveGameId();
  const structures =
    owner === undefined ? setup.store.inGame("Structure", gameId) : setup.store.structuresOwnedBy(gameId, owner);
  return [...structures]
    .flatMap((structure) => {
      const position = structureMapPosition(setup.store, structure);
      if (!position) return [];
      return [
        {
          entity_id: safeInteger(structure.entity_id),
          coord_x: position.x,
          coord_y: position.y,
          category: structure.base.category,
        },
      ];
    })
    .sort((left, right) => left.entity_id - right.entity_id);
};

/**
 * Keeps the UI on a structure for the life of the game session. The snapshot can land after boot and the account can
 * be restored after that, so a choice made once at boot left a reload with nothing selected. This chooses again when
 * the facts, the account or the signed-in player change: the player's realm once they own one, else a spectator's
 * realm: the signed-in player's own when they have one here (a player watching a game they played), else the first.
 */
export const followInitialStructure = (setup: SetupResult): (() => void) => {
  resetEntryDestination();
  // The realm this session chose for a spectator, which a realm of their own replaces; one they chose stays.
  let spectatorPick: number | null = null;
  const choose = () => {
    spectatorPick = chooseInitialStructure(setup, useUIStore.getState(), spectatorPick);
  };
  choose();
  const stopFacts = setup.store.subscribe(choose);
  const stopAccount = useAccountStore.subscribe((state, previous) => {
    if (state.account !== previous.account) choose();
  });
  const stopPlayer = followRealmsPlayer(choose);
  return () => {
    stopFacts();
    stopAccount();
    stopPlayer();
  };
};

/** Chooses the session's structure, and answers the realm it picked for a spectator (else the one it had). */
const chooseInitialStructure = (setup: SetupResult, state: AppStore, spectatorPick: number | null): number | null => {
  const hasSelection = Boolean(state.structureEntityId);
  const picked = isSpectatorFallback(state) || state.structureEntityId === spectatorPick;
  if (hasSelection && !picked) return spectatorPick;

  const viewer = accountAddress();
  const ownedStructures = viewer === null ? [] : readInitialSelectableStructures(setup, viewer);
  // A session entered to spectate has no viewer, yet opens on the signed-in player's own realm when they have one.
  const player = isExplicitSpectateSession() ? readRealmsPlayer() : null;
  const theirs = player === null ? [] : readInitialSelectableStructures(setup, BigInt(player));
  // A spectator's pick yields only to a realm of the player's own.
  if (hasSelection && ownedStructures.length === 0 && theirs.length === 0) return spectatorPick;

  const globalStructures =
    ownedStructures.length > 0 ? [] : theirs.length > 0 ? theirs : readInitialSelectableStructures(setup);
  const { selectedStructure, spectator } = resolveInitialStructureSelection({ ownedStructures, globalStructures });
  if (!selectedStructure) {
    if (subjectScopeApplied(setup, viewer)) settleEntryDestination(null);
    return spectatorPick;
  }
  const next = spectator ? selectedStructure.entity_id : null;
  if (selectedStructure.entity_id === state.structureEntityId) return next;

  const worldMapPosition = Position.fromContract({ x: selectedStructure.coord_x, y: selectedStructure.coord_y });
  state.setStructureEntityId(selectedStructure.entity_id, { spectator, worldMapPosition });
  settleEntryDestination(worldMapPosition);
  markGameEntryMilestone("initial-structure-selected");
  return next;
};

/**
 * Herald's scope for the entry's subject has applied, so a realm it has not brought is not coming: the player's own
 * scope once their account is connected; a Frontier spectator's only through the leader's visit (spectator-watch,
 * which answers for a season with no leader); elsewhere the snapshot already held every structure.
 */
const subjectScopeApplied = (setup: SetupResult, viewer: bigint | null): boolean => {
  const scope = setup.store.subscriptionScope().known;
  if (!scope) return false;
  if (viewer !== null) return scope.actor !== undefined && BigInt(scope.actor) === viewer;
  return scope.visit !== undefined || scope.expedition === undefined;
};

/** Spectating because no account had arrived, not because the player asked to spectate. */
const isSpectatorFallback = (state: AppStore): boolean => state.isSpectating && !isExplicitSpectateSession();
