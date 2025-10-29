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
  setStructureEntityId: (structureEntityId: ID) => void;
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
  setStructureEntityId: (structureEntityId: ID) => set({ structureEntityId }),
  playerStructures: [],
  setPlayerStructures: (playerStructures: Structure[]) => set({ playerStructures }),
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
