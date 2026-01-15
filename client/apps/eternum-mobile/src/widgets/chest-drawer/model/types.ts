import { ID } from "@bibliothecadao/types";

export interface ChestDrawerProps {
  explorerEntityId: ID;
  chestHex: { x: number; y: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ChestState {
  isShaking: boolean;
  hasClicked: boolean;
  clickCount: number;
  chestResult: number[] | null;
  showResult: boolean;
  isOpening: boolean;
  revealedCards: number[];
}
