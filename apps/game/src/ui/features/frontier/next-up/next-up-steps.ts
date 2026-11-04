import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { isCoarsePointer } from "@/utils/pointer";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import type { BuildingType } from "@bibliothecadao/types";
import { useEffect } from "react";

import type { useExpeditionRules } from "../frontier-home";
import { frontierCoachSteps } from "./frontier-coach";
import { useNextUpFacts } from "./next-up-facts";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

/** Next up's steps for the player's realm, as its place shows them: the one source of what Next up asks for. */
export const useNextUpSteps = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null) => {
  const facts = useNextUpFacts(rules, realm);
  const tips = useWorldAppearanceStore((state) => state.nextUpTips);
  const { isMapView } = useQuery();
  const steps = frontierCoachSteps(facts, {
    pointer: isCoarsePointer() ? "touch" : "mouse",
    where: isMapView ? "map" : "realm",
    tips,
  });
  return { facts, steps };
};

/** The building Next up asks for, its first step that names one: the build sheet opens on it. Null when none does. */
export const useNextUpBuilding = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null): BuildingType | null =>
  useNextUpSteps(rules, realm).steps.find(({ build }) => build !== null)?.build ?? null;

/** Names the building Next up asks for to the local view, which marks an open plot for it; none once the HUD leaves. */
export const useMarkAskedBuilding = (asked: BuildingType | null) => {
  const setAskedBuilding = useUIStore((state) => state.setAskedBuilding);
  useEffect(() => {
    setAskedBuilding(asked);
    return () => setAskedBuilding(null);
  }, [asked, setAskedBuilding]);
};
