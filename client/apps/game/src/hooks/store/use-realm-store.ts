import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { countAvailableRelics } from "@/ui/features/relics/utils/count-available-relics";
import { PlayerRelicsData } from "@bibliothecadao/torii";
import { ID, RelicRecipientType, Structure } from "@bibliothecadao/types";

const idsMatch = (left: unknown, right: unknown) => String(left) === String(right);

const removeRelicFromCollection = <T extends { entityId: unknown; relics?: Array<{ resourceId: unknown }> }>(
  collection: T[],
  targetEntityId: ID,
  targetResourceId: ID,
): T[] => {
  return collection.reduce<T[]>((acc, entity) => {
    if (!idsMatch(entity.entityId, targetEntityId)) {
      acc.push(entity);
      return acc;
    }

    const filteredRelics = (entity.relics ?? []).filter((relic) => !idsMatch(relic.resourceId, targetResourceId));

    if (filteredRelics.length === 0) {
      return acc;
    }

    acc.push({
      ...entity,
      relics: filteredRelics,
    });

    return acc;
  }, [] as T[]);
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
  availableRelicsNumber: number;
  setAvailableRelicsNumber: (availableRelicsNumber: number) => void;
  playerRelics: PlayerRelicsData | null;
  setPlayerRelics: (playerRelics: PlayerRelicsData | null) => void;
  playerRelicsLoading: boolean;
  setPlayerRelicsLoading: (loading: boolean) => void;
  relicsRefreshNonce: number;
  triggerRelicsRefresh: () => void;
  removeRelicFromEntity: (params: { entityId: ID; resourceId: ID; recipientType: RelicRecipientType }) => void;
}

export const createRealmStoreSlice = (set: any) => ({
  structureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  lastControlledStructureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  isSpectating: false,
  worldMapReturnPosition: null,
  setStructureEntityId: (structureEntityId: ID, options?: { spectator?: boolean; worldMapPosition?: { col: number; row: number } }) =>
    set((state: RealmStore) => {
      const ownsStructure = state.playerStructures.some((structure) =>
        idsMatch(structure.entityId, structureEntityId),
      );
      const shouldSpectate = options?.spectator ?? !ownsStructure;
      const currentStructureIsOwned = state.playerStructures.some((structure) =>
        idsMatch(structure.entityId, state.structureEntityId),
      );

      const updates: Partial<RealmStore> = {
        structureEntityId,
        isSpectating: shouldSpectate,
      };

      if (options?.worldMapPosition) {
        updates.worldMapReturnPosition = options.worldMapPosition;
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
        updates.lastControlledStructureEntityId = structureEntityId;
      }

      return updates;
    }),
  setLastControlledStructureEntityId: (structureEntityId: ID) =>
    set({
      lastControlledStructureEntityId: structureEntityId,
      structureEntityId,
      isSpectating: false,
    }),
  exitSpectatorMode: () =>
    set((state: RealmStore) => {
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

      const updates: Partial<RealmStore> = {
        playerStructures,
      };

      if (!lastControlledExists) {
        const nextControlled = playerStructures[0]?.entityId ?? UNDEFINED_STRUCTURE_ENTITY_ID;
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
  removeRelicFromEntity: ({
    entityId,
    resourceId,
    recipientType,
  }: {
    entityId: ID;
    resourceId: ID;
    recipientType: RelicRecipientType;
  }) =>
    set((state: RealmStore) => {
      if (!state.playerRelics) {
        return {};
      }

      if (recipientType === RelicRecipientType.Structure) {
        const updatedStructures = removeRelicFromCollection(state.playerRelics.structures ?? [], entityId, resourceId);
        const updatedPlayerRelics: PlayerRelicsData = {
          ...state.playerRelics,
          structures: updatedStructures,
        };

        return {
          playerRelics: updatedPlayerRelics,
          availableRelicsNumber: countAvailableRelics(updatedPlayerRelics),
        };
      }

      const updatedArmies = removeRelicFromCollection(state.playerRelics.armies ?? [], entityId, resourceId);
      const updatedPlayerRelics: PlayerRelicsData = {
        ...state.playerRelics,
        armies: updatedArmies,
      };

      return {
        playerRelics: updatedPlayerRelics,
        availableRelicsNumber: countAvailableRelics(updatedPlayerRelics),
      };
    }),
});
