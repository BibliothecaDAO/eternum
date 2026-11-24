import type { DeepArmyLife } from "@bibliothecadao/eternum/game-client";
import type { EtherealLayer } from "@bibliothecadao/eternum";
import type { IconMeaning } from "@/ui/design-system/icon";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";

export interface ArmyView {
  name: string;
  title?: string;
  art: IconMeaning;
  troops: number;
  stamina: StaminaBar;
  secondsToFull: number | undefined;
  revealYield: number | undefined | null;
  ethereal?: EtherealLayer;
  drain?: DeepArmyLife;
}
