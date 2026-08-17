import { normalizeWorldMapRoutePosition } from "@/play/navigation/play-route-target";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { countAvailableRelics } from "@/ui/features/relics/utils/count-available-relics";
import type { IncomingTroopArrival } from "@bibliothecadao/eternum";
import { PlayerRelicsData } from "@bibliothecadao/torii";
import { ID, Structure, StructureType } from "@bibliothecadao/types";
import { isExplicitSpectateSession, overrideSpectateIntent } from "@/utils/spectator-session";

const idsMatch = (left: unknown, right: unknown) => String(left) === String(right);

const normalizeStructureId = (value: ID | unknown): ID | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === "object") {
    const candidate = (value as { entityId?: unknown }).entityId;
    if (candidate !== undefined) {
      return normalizeStructureId(candidate);
    }
  }

  return null;
};

const resolvePreferredControlledStructureId = (playerStructures: Structure[]): ID => {
  const firstRealm = playerStructures.find((structure) => structure.category === StructureType.Realm);
  return firstRealm?.entityId ?? playerStructures[0]?.entityId ?? UNDEFINED_STRUCTURE_ENTITY_ID;
};

export interface RealmStore {
  structureEntityId: ID;
  lastControlledStructureEntityId: ID;
  isSpectating: boolean;
  worldMapReturnPosition: { col: number; row: number } | null;
  setStructureEntityId: (
    structureEntityId: ID,
    options?: { spectator?: boolean; worldMapPosition?: { col: number; row: number } },
  ) => void;
  setLastControlledStructureEntityId: (structureEntityId: ID) => void;
  exitSpectatorMode: () => void;
  playerStructures: Structure[];
  setPlayerStructures: (playerStructures: Structure[]) => void;
  arrivedArrivalsNumber: number;
  setArrivedArrivalsNumber: (arrivedArrivalsNumber: number) => void;
  pendingArrivalsNumber: number;
  setPendingArrivalsNumber: (pendingArrivalsNumber: number) => void;
  publicIncomingTroopArrivalsByStructure: Record<string, IncomingTroopArrival[]>;
  setPublicIncomingTroopArrivalsByStructure: (value: Record<string, IncomingTroopArrival[]>) => void;
  availableRelicsNumber: number;
  setAvailableRelicsNumber: (availableRelicsNumber: number) => void;
  playerRelics: PlayerRelicsData | null;
  setPlayerRelics: (playerRelics: PlayerRelicsData | null) => void;
  playerRelicsLoading: boolean;
  setPlayerRelicsLoading: (loading: boolean) => void;
  relicsRefreshNonce: number;
  triggerRelicsRefresh: () => void;
}

export const createRealmStoreSlice = (
  set: (partial: Partial<RealmStore> | ((state: RealmStore) => Partial<RealmStore>)) => void,
) => ({
  structureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  lastControlledStructureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  isSpectating: false,
  worldMapReturnPosition: null,
  setStructureEntityId: (
    structureEntityId: ID,
    options?: { spectator?: boolean; worldMapPosition?: { col: number; row: number } },
  ) =>
    set((state: RealmStore) => {
      const normalizedId = normalizeStructureId(structureEntityId);
      if (normalizedId === null) {
        console.warn("[RealmStore] Ignoring invalid structure id", structureEntityId);
        return state;
      }

      const ownsStructure = state.playerStructures.some((structure) => idsMatch(structure.entityId, normalizedId));
      // Owning a structure means you're playing it — never auto-set spectator
      // mode while the player is looking at one of their own structures, even
      // if the caller passed spectator: true. worldmap.tsx forwards the stale
      // isSpectating flag when a hex is clicked, which would otherwise keep
      // the SPECTATING badge on after the player mid-sessions settles their
      // first realm. Exception: an explicit ?spectate=true session stays a
      // spectator even when the logged-in account owns structures here.
      const explicitSpectate = isExplicitSpectateSession();
      const requestedSpectate = options?.spectator ?? (explicitSpectate || !ownsStructure);
      const shouldSpectate = ownsStructure && !explicitSpectate ? false : requestedSpectate;
      const currentStructureIsOwned = state.playerStructures.some((structure) =>
        idsMatch(structure.entityId, state.structureEntityId),
      );

      const updates: Partial<RealmStore> = {
        structureEntityId: normalizedId,
        isSpectating: shouldSpectate,
      };

      if (options?.worldMapPosition) {
        updates.worldMapReturnPosition = normalizeWorldMapRoutePosition(options.worldMapPosition);
      }

      if (shouldSpectate) {
        if (
          !state.isSpectating &&
          currentStructureIsOwned &&
          state.structureEntityId !== UNDEFINED_STRUCTURE_ENTITY_ID
        ) {
          updates.lastControlledStructureEntityId = state.structureEntityId;
        }
      } else {
        updates.lastControlledStructureEntityId = normalizedId;
      }

      return updates;
    }),
  setLastControlledStructureEntityId: (structureEntityId: ID) =>
    set((state: RealmStore) => {
      const normalizedId = normalizeStructureId(structureEntityId);
      if (normalizedId === null) {
        console.warn("[RealmStore] Ignoring invalid structure id", structureEntityId);
        return state;
      }

      return {
        lastControlledStructureEntityId: normalizedId,
        structureEntityId: normalizedId,
        isSpectating: false,
      };
    }),
  exitSpectatorMode: () =>
    set((state: RealmStore) => {
      // A deliberate exit clears the latched session intent too, or the
      // spectator chokepoints would keep suppressing ownership chrome.
      overrideSpectateIntent(false);
      const fallback =
        state.lastControlledStructureEntityId !== UNDEFINED_STRUCTURE_ENTITY_ID
          ? state.lastControlledStructureEntityId
          : UNDEFINED_STRUCTURE_ENTITY_ID;

      return {
        structureEntityId: fallback,
        isSpectating: false,
      } as Partial<RealmStore>;
    }),
  playerStructures: [],
  setPlayerStructures: (playerStructures: Structure[]) =>
    set((state: RealmStore) => {
      const lastControlledExists = playerStructures.some((structure) =>
        idsMatch(structure.entityId, state.lastControlledStructureEntityId),
      );
      const currentStructureIsOwned = playerStructures.some((structure) =>
        idsMatch(structure.entityId, state.structureEntityId),
      );

      const updates: Partial<RealmStore> = {
        playerStructures,
      };

      const shouldRecoverFromStartupSpectator =
        state.isSpectating &&
        !isExplicitSpectateSession() &&
        state.lastControlledStructureEntityId === UNDEFINED_STRUCTURE_ENTITY_ID &&
        !currentStructureIsOwned &&
        playerStructures.length > 0;

      if (shouldRecoverFromStartupSpectator) {
        const nextControlled = resolvePreferredControlledStructureId(playerStructures);
        updates.lastControlledStructureEntityId = nextControlled;
        updates.structureEntityId = nextControlled;
        updates.isSpectating = false;
        return updates;
      }

      // Mid-session settle: the player started as a spectator and has just
      // acquired the very structure they were viewing. Drop the stale flag so
      // the HUD chrome (structure list, action buttons) reappears.
      if (state.isSpectating && currentStructureIsOwned && !isExplicitSpectateSession()) {
        updates.isSpectating = false;
        if (state.lastControlledStructureEntityId === UNDEFINED_STRUCTURE_ENTITY_ID) {
          updates.lastControlledStructureEntityId = state.structureEntityId;
        }
      }

      if (!lastControlledExists) {
        const nextControlled = resolvePreferredControlledStructureId(playerStructures);
        updates.lastControlledStructureEntityId = nextControlled;

        if (!state.isSpectating) {
          updates.structureEntityId = nextControlled;
        }
      }

      return updates;
    }),
  arrivedArrivalsNumber: 0,
  setArrivedArrivalsNumber: (arrivedArrivalsNumber: number) => set({ arrivedArrivalsNumber }),
  pendingArrivalsNumber: 0,
  setPendingArrivalsNumber: (pendingArrivalsNumber: number) => set({ pendingArrivalsNumber }),
  publicIncomingTroopArrivalsByStructure: {},
  setPublicIncomingTroopArrivalsByStructure: (
    publicIncomingTroopArrivalsByStructure: Record<string, IncomingTroopArrival[]>,
  ) => set({ publicIncomingTroopArrivalsByStructure }),
  availableRelicsNumber: 0,
  setAvailableRelicsNumber: (availableRelicsNumber: number) => set({ availableRelicsNumber }),
  playerRelics: null,
  setPlayerRelics: (playerRelics: PlayerRelicsData | null) =>
    set({
      playerRelics,
      availableRelicsNumber: countAvailableRelics(playerRelics),
    }),
  playerRelicsLoading: true,
  setPlayerRelicsLoading: (loading: boolean) => set({ playerRelicsLoading: loading }),
  relicsRefreshNonce: 0,
  triggerRelicsRefresh: () => set((state: RealmStore) => ({ relicsRefreshNonce: state.relicsRefreshNonce + 1 })),
});
