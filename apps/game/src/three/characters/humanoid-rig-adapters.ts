import { validateHumanoidRigAdapter, type HumanoidRigAdapter } from "./humanoid-rig-adapter";
import { QUATERNIUS_HUMANOID_RIG_ADAPTER } from "./quaternius-humanoid-rig-adapter";
import { BASTION_KNIGHT_HUMANOID_RIG_ADAPTER } from "./bastion-knight-humanoid-rig-adapter";

const HUMANOID_RIG_ADAPTERS = {
  [BASTION_KNIGHT_HUMANOID_RIG_ADAPTER.id]: BASTION_KNIGHT_HUMANOID_RIG_ADAPTER,
  [QUATERNIUS_HUMANOID_RIG_ADAPTER.id]: QUATERNIUS_HUMANOID_RIG_ADAPTER,
} satisfies Readonly<Record<string, HumanoidRigAdapter>>;

export type HumanoidRigAdapterId = keyof typeof HUMANOID_RIG_ADAPTERS;

export function resolveHumanoidRigAdapter(id: HumanoidRigAdapterId): HumanoidRigAdapter {
  const adapter = HUMANOID_RIG_ADAPTERS[id];
  if (!adapter) throw new Error(`Unknown humanoid rig adapter "${id}"`);
  const issues = validateHumanoidRigAdapter(adapter);
  if (issues.length > 0) throw new Error(`Humanoid rig adapter ${id} is invalid: ${issues.join(", ")}`);
  return adapter;
}
