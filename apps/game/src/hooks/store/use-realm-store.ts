import { mapRouteHex } from "@/play/navigation/play-route";
import type { Position } from "@bibliothecadao/eternum";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { readActivePlayerStructures } from "@/sync/fact-views";
import { ID } from "@bibliothecadao/types";
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

export interface RealmStore {
  structureEntityId: ID;
  lastControlledStructureEntityId: ID;
  isSpectating: boolean;
  /** Where the world map re-opens: a map URL's hex, normalized (mapRouteHex). */
  worldMapReturnPosition: { col: number; row: number } | null;
  setStructureEntityId: (structureEntityId: ID, options?: { spectator?: boolean; worldMapPosition?: Position }) => void;
  setLastControlledStructureEntityId: (structureEntityId: ID) => void;
  exitSpectatorMode: () => void;
  arrivedArrivalsNumber: number;
  arrivedArrivalStructureIds: ID[];
  setArrivalIndicators: (
    indicators: Pick<RealmStore, "arrivedArrivalsNumber" | "pendingArrivalsNumber" | "arrivedArrivalStructureIds">,
  ) => void;
  pendingArrivalsNumber: number;
}

export const createRealmStoreSlice = (
  set: (partial: Partial<RealmStore> | ((state: RealmStore) => Partial<RealmStore>)) => void,
) => ({
  structureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  lastControlledStructureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  isSpectating: false,
  worldMapReturnPosition: null,
  setStructureEntityId: (structureEntityId: ID, options?: { spectator?: boolean; worldMapPosition?: Position }) =>
    set((state: RealmStore) => {
      const normalizedId = normalizeStructureId(structureEntityId);
      if (normalizedId === null) {
        console.warn("[RealmStore] Ignoring invalid structure id", structureEntityId);
        return state;
      }

      const playerStructures = readActivePlayerStructures();
      const ownsStructure = playerStructures.some((structure) => idsMatch(structure.entityId, normalizedId));
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
      const currentStructureIsOwned = playerStructures.some((structure) =>
        idsMatch(structure.entityId, state.structureEntityId),
      );

      const updates: Partial<RealmStore> = {
        structureEntityId: normalizedId,
        isSpectating: shouldSpectate,
      };

      if (options?.worldMapPosition) {
        updates.worldMapReturnPosition = mapRouteHex(options.worldMapPosition);
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
  arrivedArrivalsNumber: 0,
  arrivedArrivalStructureIds: [],
  setArrivalIndicators: (indicators: Parameters<RealmStore["setArrivalIndicators"]>[0]) => set(indicators),
  pendingArrivalsNumber: 0,
});
