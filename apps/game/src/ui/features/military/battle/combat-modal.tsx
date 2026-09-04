import { ActorType, ID } from "@bibliothecadao/types";

import { BattleLab } from "./battle-lab";

/**
 * Thin live-mode adapter around the merged {@link BattleLab}. Kept as the
 * `CombatModal` export so existing callers (quick-attack "Details") and tests
 * stay stable. The Battle Lab renders its own modal shell.
 */
export const CombatModal = ({
  selected,
  target,
}: {
  selected: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
  target: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
}) => {
  return <BattleLab mode="live" selected={selected} target={target} />;
};
