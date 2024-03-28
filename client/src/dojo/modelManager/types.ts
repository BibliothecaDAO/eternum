import { Type } from "@dojoengine/recs";

export type ProductionType = {
  entity_id: Type.BigInt;
  resource_type: Type.Number;
  production_rate: Type.Number; // per tick
  production_boost_rate: Type.Number; // per tick
  consumed_rate: Type.Number; // per tick
  last_updated: Type.Number;
  active: Type.Boolean;
};

export type ResourceType = {
  entity_id: Type.BigInt;
  resource_type: Type.Number;
  balance: Type.BigInt;
};
