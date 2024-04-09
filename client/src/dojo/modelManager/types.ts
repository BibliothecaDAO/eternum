import { Type as RecsType } from "@dojoengine/recs";

export type ProductionType = {
  entity_id: RecsType.BigInt;
  resource_type: RecsType.Number;
  building_count: RecsType.BigInt;
  production_rate: RecsType.BigInt;
  bonus_percent: RecsType.BigInt;
  consumption_rate: RecsType.BigInt;
  last_updated_tick: RecsType.Number;
  materials_exhaustion_tick: RecsType.Number;
  active: RecsType.Boolean;
};

export type ResourceType = {
  entity_id: RecsType.BigInt;
  resource_type: RecsType.Number;
  balance: RecsType.BigInt;
};

export type BuildingType = {
  outer_col: RecsType.BigInt;
  outer_row: RecsType.BigInt;
  inner_col: RecsType.BigInt;
  inner_row: RecsType.BigInt;
  id: RecsType.BigInt;
  // todo: check if works with enum
  category: RecsType.Number;
  produced_resource_type: RecsType.Number;
  entity_id: RecsType.BigInt;
  outer_entity_id: RecsType.BigInt;
};
