import type { ArmyData } from "../types";

interface LabelWithRenderState {
  visible: boolean;
  userData: {
    lastDataKey?: string | null;
    lastLayoutDataKey?: string | null;
    lastStaminaDataKey?: string | null;
  };
}

export type ArmyLabelContentFields = Pick<
  ArmyData,
  | "troopCount"
  | "currentStamina"
  | "maxStamina"
  | "displayStaminaRatio"
  | "battleTimerLeft"
  | "isMine"
  | "owner"
  | "attackedFromDegrees"
  | "attackedTowardDegrees"
>;

export function buildArmyLabelLayoutDataKey(army: ArmyLabelContentFields): string {
  return `${army.troopCount}-${army.battleTimerLeft ?? 0}-${army.isMine}-${army.owner.ownerName}-${army.attackedFromDegrees ?? ""}-${army.attackedTowardDegrees ?? ""}`;
}

export function buildArmyLabelStaminaDataKey(army: ArmyLabelContentFields): string {
  return `${army.currentStamina}-${army.maxStamina}`;
}

export function syncArmyLabelContentState(input: {
  label: LabelWithRenderState;
  layoutDataKey: string;
  staminaDataKey: string;
  labelsAttachedToScene: boolean;
  renderLabel: () => void;
  renderStamina: () => void;
}): void {
  const isVisible = input.labelsAttachedToScene && input.label.visible === true;

  if (
    isVisible &&
    input.label.userData.lastLayoutDataKey === input.layoutDataKey &&
    input.label.userData.lastStaminaDataKey === input.staminaDataKey
  ) {
    return;
  }

  if (!isVisible) {
    input.label.userData.lastDataKey = null;
    input.label.userData.lastLayoutDataKey = null;
    input.label.userData.lastStaminaDataKey = null;
    return;
  }

  const layoutChanged = input.label.userData.lastLayoutDataKey !== input.layoutDataKey;

  input.label.userData.lastLayoutDataKey = input.layoutDataKey;
  input.label.userData.lastStaminaDataKey = input.staminaDataKey;
  input.label.userData.lastDataKey = `${input.layoutDataKey}|${input.staminaDataKey}`;

  if (!layoutChanged) {
    input.renderStamina();
    return;
  }

  input.renderLabel();
}
