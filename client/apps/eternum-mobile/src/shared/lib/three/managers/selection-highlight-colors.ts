import { ActionType } from "@bibliothecadao/eternum";
import * as THREE from "three";

const ACTION_HIGHLIGHT_COLORS: Record<ActionType, THREE.Color> = {
  [ActionType.Move]: new THREE.Color().setRGB(0.5, 2.0, 0.0),
  [ActionType.Attack]: new THREE.Color().setRGB(2.5, 0.5, 0.0),
  [ActionType.Help]: new THREE.Color().setRGB(1.8, 0.3, 2.0),
  [ActionType.Explore]: new THREE.Color().setRGB(0.0, 1.2, 2.0),
  [ActionType.Quest]: new THREE.Color().setRGB(1.0, 1.0, 0.0),
  [ActionType.Build]: new THREE.Color().setRGB(1.5, 1.2, 0.0),
  [ActionType.Chest]: new THREE.Color().setRGB(2.0, 1.5, 0.0),
  [ActionType.CreateArmy]: new THREE.Color().setRGB(1.0, 1.5, 2.0),
  [ActionType.SpireTravel]: new THREE.Color().setRGB(0.6, 1.2, 2.5),
};

export function resolveSelectionHighlightColor(actionType: ActionType): THREE.Color {
  return ACTION_HIGHLIGHT_COLORS[actionType];
}
