import { ClientComponents } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";

export const getProductionBoostsFromToriiEntity = (entity: any): ComponentValue<ClientComponents["ProductionBoostBonus"]["schema"]> => {
  return {
    structure_id: entity.structure_id.value,
    wonder_incr_percent_num: entity.wonder_incr_percent_num.value,
    incr_resource_rate_percent_num: entity.incr_resource_rate_percent_num.value,
    incr_labor_rate_percent_num: entity.incr_labor_rate_percent_num.value,
    incr_troop_rate_percent_num: entity.incr_troop_rate_percent_num.value,
    incr_resource_rate_end_tick: entity.incr_resource_rate_end_tick.value,
    incr_labor_rate_end_tick: entity.incr_labor_rate_end_tick.value,
    incr_troop_rate_end_tick: entity.incr_troop_rate_end_tick.value,
  };
};
