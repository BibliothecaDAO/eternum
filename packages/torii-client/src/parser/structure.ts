import { ClientComponents, ContractAddress } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";

export const getStructureFromToriiEntity = (entityData: any) => {
  const structure: ComponentValue<ClientComponents["Structure"]["schema"]> = {
    entity_id: entityData.entity_id?.value,
    owner: ContractAddress(entityData.owner?.value),
    category: entityData.category?.value,
    resources_packed: entityData.resources_packed?.value,
    base: {
      troop_guard_count: entityData.base?.value?.troop_guard_count?.value,
      troop_explorer_count: entityData.base?.value?.troop_explorer_count?.value,
      troop_max_guard_count: entityData.base?.value?.troop_max_guard_count?.value,
      troop_max_explorer_count: entityData.base?.value?.troop_max_explorer_count?.value,
      created_at: entityData.base?.value?.created_at?.value,
      category: entityData.base?.value?.category?.value,
      coord_x: entityData.base?.value?.coord_x?.value,
      coord_y: entityData.base?.value?.coord_y?.value,
      level: entityData.base?.value?.level?.value,
    },
    troop_guards: {
      delta: {
        category: entityData.troop_guards?.value?.delta?.value?.category?.value?.option,
        tier: entityData.troop_guards?.value?.delta?.value?.tier?.value?.option,
        count: entityData.troop_guards?.value?.delta?.value?.count?.value,
        stamina: {
          amount: entityData.troop_guards?.value?.delta?.value?.stamina?.value?.amount?.value,
          updated_tick: entityData.troop_guards?.value?.delta?.value?.stamina?.value?.updated_tick?.value,
        },
      },
      charlie: {
        category: entityData.troop_guards?.value?.charlie?.value?.category?.value?.option,
        tier: entityData.troop_guards?.value?.charlie?.value?.tier?.value?.option,
        count: entityData.troop_guards?.value?.charlie?.value?.count?.value,
        stamina: {
          amount: entityData.troop_guards?.value?.charlie?.value?.stamina?.value?.amount?.value,
          updated_tick: entityData.troop_guards?.value?.charlie?.value?.stamina?.value?.updated_tick?.value,
        },
      },
      bravo: {
        category: entityData.troop_guards?.value?.bravo?.value?.category?.value?.option,
        tier: entityData.troop_guards?.value?.bravo?.value?.tier?.value?.option,
        count: entityData.troop_guards?.value?.bravo?.value?.count?.value,
        stamina: {
          amount: entityData.troop_guards?.value?.bravo?.value?.stamina?.value?.amount?.value,
          updated_tick: entityData.troop_guards?.value?.bravo?.value?.stamina?.value?.updated_tick?.value,
        },
      },
      alpha: {
        category: entityData.troop_guards?.value?.alpha?.value?.category?.value?.option,
        tier: entityData.troop_guards?.value?.alpha?.value?.tier?.value?.option,
        count: entityData.troop_guards?.value?.alpha?.value?.count?.value,
        stamina: {
          amount: entityData.troop_guards?.value?.alpha?.value?.stamina?.value?.amount?.value,
          updated_tick: entityData.troop_guards?.value?.alpha?.value?.stamina?.value?.updated_tick?.value,
        },
      },
      delta_destroyed_tick: entityData.troop_guards?.value?.delta_destroyed_tick?.value,
      charlie_destroyed_tick: entityData.troop_guards?.value?.charlie_destroyed_tick?.value,
      bravo_destroyed_tick: entityData.troop_guards?.value?.bravo_destroyed_tick?.value,
      alpha_destroyed_tick: entityData.troop_guards?.value?.alpha_destroyed_tick?.value,
    },
    troop_explorers: entityData.troop_explorers?.value || [],
    metadata: {
      realm_id: entityData.metadata?.value?.realm_id?.value,
      order: entityData.metadata?.value?.order?.value,
      has_wonder: entityData.metadata?.value?.has_wonder?.value,
      villages_count: entityData.metadata?.value?.villages_count?.value,
      village_realm: entityData.metadata?.value?.village_realm?.value,
    },
  };

  return structure;
};
