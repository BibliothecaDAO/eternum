import type { DeepArmyLife } from "@bibliothecadao/eternum/game-client";
import type { EtherealLayer } from "@bibliothecadao/eternum";
import type { TroopType } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import type { TroopFigures } from "@/ui/design-system/kit/words";
import type { ArmyStaminaCosts } from "../deploy/troop-figures";

export interface ArmyView {
  art: IconMeaning;
  troops: number;
  category?: TroopType;
  figures?: TroopFigures;
  staminaCosts?: ArmyStaminaCosts;
  stamina: StaminaBar;
  secondsToFull: number | undefined;
  ethereal?: EtherealLayer;
  drain?: DeepArmyLife;
}
