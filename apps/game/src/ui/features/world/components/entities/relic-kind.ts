import type { HudRelic } from "@/ui/design-system/kit/hud-elements";
import type { RelicInfo } from "@bibliothecadao/types";
import type { ComponentProps } from "react";

/** What a relic works on, as the sheet's relic chip colours it. */
export const RELIC_KIND: Record<RelicInfo["type"], ComponentProps<typeof HudRelic>["kind"]> = {
  Stamina: "stamina",
  Damage: "damage",
  "Damage Reduction": "damage-reduction",
  Exploration: "exploration",
  Production: "production",
};
