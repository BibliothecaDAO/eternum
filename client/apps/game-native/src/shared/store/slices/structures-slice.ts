import {UNDEFINED_STRUCTURE_ENTITY_ID} from '../../consts';
import {ID, RealmInfo} from '@bibliothecadao/types';

export interface StructuresSlice {
  selectedRealm: RealmInfo | null;
  structureEntityId: ID;
  setSelectedStructure: (realm: RealmInfo | null) => void;
}

export const createStructuresSlice = (set: any): StructuresSlice => ({
  selectedRealm: null,
  structureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  setSelectedStructure: (realm: RealmInfo | null) =>
    set({
      selectedRealm: realm,
      structureEntityId: realm?.entityId ?? UNDEFINED_STRUCTURE_ENTITY_ID,
    }),
});
