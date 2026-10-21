import { BuildingType } from "@bibliothecadao/types";
import { buildingModelPaths, BUILDINGS_GROUPS } from "../../constants/scene-constants";
import { mountStaticLineup, type LineupSettings } from "./static-model-lineup";

export const WORKSHOP_LINEUP = [
  { label: "Farm · shipped", path: "/models/new-buildings-opt/farm.glb", name: "Farm" },
  {
    label: "Workshop · Craft Yard",
    path: buildingModelPaths()[BUILDINGS_GROUPS.BUILDINGS][BuildingType.ResourceLabor],
    name: "Workshop",
  },
  { label: "Workers Hut · shipped", path: "/models/new-buildings-opt/workers_hut.glb", name: "WorkersHut" },
] as const;

export interface WorkshopLabSettings {
  distance: number;
  focus: "lineup" | "workshop";
  yaw: number;
  lighting: "day" | "sunset";
}

/** The workshop uses the common game-renderer lineup. */
export async function mountWorkshopLab(container: HTMLElement, settings: WorkshopLabSettings, signal: AbortSignal) {
  const convert = (value: WorkshopLabSettings): LineupSettings => ({
    ...value,
    focus: value.focus === "workshop" ? 1 : "lineup",
  });
  const mounted = await mountStaticLineup(
    container,
    convert(settings),
    signal,
    WORKSHOP_LINEUP.map((asset) => ({ label: asset.label, parts: [{ path: asset.path }] })),
  );
  return {
    assets: mounted.assets,
    update: (value: WorkshopLabSettings) => mounted.update(convert(value)),
    dispose: mounted.dispose,
  };
}
