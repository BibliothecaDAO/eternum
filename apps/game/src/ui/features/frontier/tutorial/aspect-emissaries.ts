import type { CSSProperties } from "react";
import { aspectName, type AspectId } from "@bibliothecadao/types";
import { aspectVariables } from "@/tokens";

export interface ResolvedAspectEmissary {
  readonly aspectId: AspectId;
  readonly name: string;
  readonly style: CSSProperties;
}

export function resolveAspectEmissary(aspectId: AspectId): ResolvedAspectEmissary {
  return {
    aspectId,
    name: aspectName(aspectId),
    style: aspectVariables(aspectId) as CSSProperties,
  };
}
