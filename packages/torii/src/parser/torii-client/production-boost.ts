import { ClientComponents } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";

export const getProductionBoostFromToriiEntity = (
  entity: any,
): ComponentValue<ClientComponents["ProductionBoostBonus"]["schema"]> => {
  const coordValue = entity.coord?.value;
  return {
    // s2 single world: every per-game model leads with game_id (absent on legacy worlds -> 0).
    game_id: entity.game_id?.value ?? 0,
    structure_id: entity.structure_id.value,
    incr_labor_rate_end_tick: entity.incr_labor_rate_end_tick.value,
    incr_labor_rate_percent_num: entity.incr_labor_rate_percent_num.value,
    incr_resource_rate_end_tick: entity.incr_resource_rate_end_tick.value,
    incr_resource_rate_percent_num: entity.incr_resource_rate_percent_num.value,
    incr_troop_rate_end_tick: entity.incr_troop_rate_end_tick.value,
    incr_troop_rate_percent_num: entity.incr_troop_rate_percent_num.value,
    wonder_incr_percent_num: entity.wonder_incr_percent_num.value,
    coord: {
      alt: coordValue?.alt?.value ?? coordValue?.alt ?? false,
      x: coordValue?.x?.value ?? coordValue?.x ?? 0,
      y: coordValue?.y?.value ?? coordValue?.y ?? 0,
    },
  };
};
