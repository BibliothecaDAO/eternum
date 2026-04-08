import type { ArmyData } from "../types";

interface LabelWithRenderState {
  visible: boolean;
  userData: {
    lastDataKey: string | null;
  };
}

type ArmyLabelContentFields = Pick<
  ArmyData,
  | "troopCount"
  | "currentStamina"
  | "battleTimerLeft"
  | "isMine"
  | "owner"
  | "attackedFromDegrees"
  | "attackedTowardDegrees"
>;

export function buildArmyLabelDataKey(army: ArmyLabelContentFields): string {
  return `${army.troopCount}-${army.currentStamina}-${army.battleTimerLeft ?? 0}-${army.isMine}-${army.owner.ownerName}-${army.attackedFromDegrees ?? ""}-${army.attackedTowardDegrees ?? ""}`;
}

export function syncArmyLabelContentState(input: {
  label: LabelWithRenderState;
  dataKey: string;
  labelsAttachedToScene: boolean;
  renderLabel: () => void;
}): void {
  const isVisible = input.labelsAttachedToScene && input.label.visible === true;

  if (isVisible && input.label.userData.lastDataKey === input.dataKey) {
    return;
  }

  if (!isVisible) {
    input.label.userData.lastDataKey = null;
    return;
  }

  input.label.userData.lastDataKey = input.dataKey;
  input.renderLabel();
}
