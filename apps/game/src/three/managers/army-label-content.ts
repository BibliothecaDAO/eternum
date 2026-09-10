import type { ArmyData } from "../types";

interface LabelWithRenderState {
  visible: boolean;
  userData: {
    lastDataKey?: string | null;
  };
}

export type ArmyLabelContentFields = Pick<
  ArmyData,
  "troopCount" | "battleTimerLeft" | "isMine" | "owner" | "attackedFromDegrees" | "attackedTowardDegrees"
>;

export function buildArmyLabelDataKey(army: ArmyLabelContentFields): string {
  return `${army.troopCount}-${army.battleTimerLeft ?? 0}-${army.isMine}-${army.owner.ownerName}-${army.attackedFromDegrees ?? ""}-${army.attackedTowardDegrees ?? ""}`;
}

/** Rerenders a visible label only when its data key moved; a hidden label forgets its key so it rerenders on return. */
export function syncArmyLabelContentState(input: {
  label: LabelWithRenderState;
  dataKey: string;
  labelsAttachedToScene: boolean;
  renderLabel: () => void;
}): void {
  const isVisible = input.labelsAttachedToScene && input.label.visible === true;

  if (!isVisible) {
    input.label.userData.lastDataKey = null;
    return;
  }
  if (input.label.userData.lastDataKey === input.dataKey) return;

  input.label.userData.lastDataKey = input.dataKey;
  input.renderLabel();
}
