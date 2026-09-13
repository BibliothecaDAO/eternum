import type { ClientComponents } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { gameEntityKey } from "@/sync/game-scope";
import type { HyperstructureConstruction } from "./hyperstructure-design";

/** Missing snapshot rows keep the foundation visible until the authoritative rows arrive. */
export function readHyperstructureConstruction(
  components: ClientComponents,
  entityId: number,
): HyperstructureConstruction {
  const key = gameEntityKey([BigInt(entityId)]);
  const structure = getComponentValue(components.Hyperstructure, key);
  const requirements = getComponentValue(components.HyperstructureRequirements, key);
  const completed = structure?.completed === true;
  if (completed) return { entityId, progress: 100, completed };
  if (!requirements) return { entityId, progress: 0, completed };
  const needed = BigInt(requirements.needed_resource_total);
  const current = BigInt(requirements.current_resource_total);
  if (needed <= 0n) {
    if (current > 0n) throw new Error(`Hyperstructure ${entityId} has contributions without resource requirements`);
    return { entityId, progress: 0, completed };
  }
  return { entityId, progress: Math.min(100, Number((current * 10000n) / needed) / 100), completed };
}
