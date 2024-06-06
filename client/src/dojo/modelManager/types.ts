import { Type as RecsType } from "@dojoengine/recs";

export type LiquidityType = {
  bank_entity_id: RecsType.BigInt;
  player: RecsType.BigInt;
  resource_type: RecsType.BigInt;
  shares: {
    mag: RecsType.BigInt;
    sign: RecsType.Boolean;
  };
};

export type MarketType = {
  bank_entity_id: RecsType.BigInt;
  resource_type: RecsType.BigInt;
  lords_amount: RecsType.BigInt;
  resource_amount: RecsType.BigInt;
  total_shares: {
    mag: RecsType.BigInt;
    sign: RecsType.Boolean;
  };
};

export type ProductionType = {
  entity_id: RecsType.BigInt;
  resource_type: RecsType.Number;
  building_count: RecsType.BigInt;
  production_rate: RecsType.BigInt;
  consumption_rate: RecsType.BigInt;
  last_updated_tick: RecsType.BigInt;
  input_finish_tick: RecsType.BigInt;
};

export type ResourceType = {
  entity_id: RecsType.BigInt;
  resource_type: RecsType.Number;
  balance: RecsType.BigInt;
};

export type BuildQuantityType = {
  entity_id: RecsType.BigInt;
  category: RecsType.Number;
  value: RecsType.Number;
};

export type BuildingType = {
  outer_col: RecsType.BigInt;
  outer_row: RecsType.BigInt;
  inner_col: RecsType.BigInt;
  inner_row: RecsType.BigInt;
  category: RecsType.String;
  produced_resource_type: RecsType.Number;
  entity_id: RecsType.BigInt;
  outer_entity_id: RecsType.BigInt;
};

export type QuantityTrackerType = {
  entity_id: RecsType.BigInt;
  count: RecsType.BigInt;
};

export type BattleType = {
  entity_id: RecsType.BigInt;
  attack_army: {
    troops: {
      knight_count: RecsType.Number;
      paladin_count: RecsType.Number;
      crossbowman_count: RecsType.Number;
    };
    battle_id: RecsType.BigInt;
    battle_side: RecsType.Number;
  };
  defence_army: {
    troops: {
      knight_count: RecsType.Number;
      paladin_count: RecsType.Number;
      crossbowman_count: RecsType.Number;
    };
    battle_id: RecsType.BigInt;
    battle_side: RecsType.Number;
  };
  attack_army_health: { current: RecsType.BigInt; lifetime: RecsType.BigInt };
  defence_army_health: { current: RecsType.BigInt; lifetime: RecsType.BigInt };
  attack_delta: RecsType.Number;
  defence_delta: RecsType.Number;
  last_updated: RecsType.BigInt;
  duration_left: RecsType.BigInt;
};
