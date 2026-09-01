import { validateHorseRigAdapter, type HorseRigAdapter } from "./horse-rig-adapter";
import { QUATERNIUS_HORSE_RIG_ADAPTER } from "./quaternius-horse-rig-adapter";

const HORSE_RIG_ADAPTERS = {
  [QUATERNIUS_HORSE_RIG_ADAPTER.id]: QUATERNIUS_HORSE_RIG_ADAPTER,
} satisfies Readonly<Record<string, HorseRigAdapter>>;

export type HorseRigAdapterId = keyof typeof HORSE_RIG_ADAPTERS;

export function resolveHorseRigAdapter(id: HorseRigAdapterId): HorseRigAdapter {
  const adapter = HORSE_RIG_ADAPTERS[id];
  if (!adapter) throw new Error(`Unknown horse rig adapter "${id}"`);
  const issues = validateHorseRigAdapter(adapter);
  if (issues.length > 0) throw new Error(`Horse rig adapter ${id} is invalid: ${issues.join(", ")}`);
  return adapter;
}
