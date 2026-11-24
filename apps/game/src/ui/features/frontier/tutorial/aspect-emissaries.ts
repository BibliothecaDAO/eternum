import type { CSSProperties } from "react";
import { aspectName, type AspectId } from "@bibliothecadao/types";
import { aspectVariables } from "@/tokens";
import type { IconMeaning } from "@/ui/design-system/icon";

export const ASPECT_EMISSARY_PORTRAITS = {
  1: "emissary-prowess",
  2: "emissary-luminary",
  3: "emissary-havoc",
  4: "emissary-insight",
} as const satisfies Record<AspectId, IconMeaning>;

export interface ResolvedAspectEmissary {
  readonly aspectId: AspectId;
  readonly name: string;
  readonly portrait: IconMeaning;
  readonly style: CSSProperties;
}

export function resolveAspectEmissary(aspectId: AspectId): ResolvedAspectEmissary {
  return {
    aspectId,
    name: aspectName(aspectId),
    portrait: ASPECT_EMISSARY_PORTRAITS[aspectId],
    style: aspectVariables(aspectId) as CSSProperties,
  };
}
