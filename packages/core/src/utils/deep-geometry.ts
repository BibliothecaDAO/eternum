import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import { aspects, type AspectId } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { journeyDistance, surfaceNeighborAtDistance } from "./travel";

export function deepCenter(spacing: number): { col: number; row: number } {
  if (spacing < nativeRuleConstants.DEEP_MAP_SIZE * 2) throw new Error("Deep needs a full expedition region");
  return { col: Math.floor(spacing / 2), row: spacing * 3 + Math.floor(spacing / 2) };
}

export function isDeepTile(spacing: number, tile: { col: number; row: number; alt: boolean }): boolean {
  if (tile.alt || spacing < nativeRuleConstants.DEEP_MAP_SIZE * 2) return false;
  const center = deepCenter(spacing);
  const half = nativeRuleConstants.DEEP_MAP_SIZE / 2;
  return (
    tile.col >= center.col - half &&
    tile.col < center.col + half &&
    tile.row >= center.row - half &&
    tile.row < center.row + half
  );
}

function deepGate(spacing: number, gateDistance: number, aspect: number): { col: number; row: number } {
  if (aspect < 1 || aspect > 4) throw new Error(`No gate for Aspect ${aspect}`);
  const center = deepCenter(spacing);
  const { x, y } = compassPoint({ x: center.col, y: center.row }, aspect - 1, gateDistance);
  return { col: x, row: y };
}

const compassPoint = (origin: { x: number; y: number }, point: number, distance: number) => {
  if (point === 0) return zigzag(origin, 1, 2, distance);
  if (point === 1) return surfaceNeighborAtDistance(origin, 0, distance);
  if (point === 2) return zigzag(origin, 4, 5, distance);
  return surfaceNeighborAtDistance(origin, 3, distance);
};

const zigzag = (origin: { x: number; y: number }, first: number, second: number, distance: number) =>
  surfaceNeighborAtDistance(
    surfaceNeighborAtDistance(origin, first, Math.ceil(distance / 2)),
    second,
    Math.floor(distance / 2),
  );

export function deepViewFor(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  home: bigint | null,
  spacing: number,
): { col: number; row: number } {
  const rules = store.get("DeepRules", { game_id: gameId });
  if (!rules) throw new Error("A gate view needs the game's DeepRules row");
  const aspect = home === null ? undefined : store.get("HomeAspect", { game_id: gameId, home })?.aspect;
  return aspect ? deepGate(spacing, rules.gate_distance, aspect) : deepCenter(spacing);
}

export function deepGateTiles(gateDistance: number, spacing: number): { aspect: AspectId; col: number; row: number }[] {
  return aspects.map(({ id }) => ({ aspect: id, ...deepGate(spacing, gateDistance, id) }));
}

export type DeepZone = "plaza" | "ring" | "field" | "rim";

const DEEP_RIM_MARGIN = 1;

type DeepZoneRules = { rings: readonly { radius: number }[] };

export function deepZoneBounds(rules: DeepZoneRules): { plazaBelow: number; ringRadii: number[]; rimBeyond: number } {
  const ringRadii = [...new Set(rules.rings.map(({ radius }) => radius))].sort((a, b) => a - b);
  return {
    plazaBelow: nativeRuleConstants.DEEP_PLAZA_RADIUS + 1,
    ringRadii,
    rimBeyond: Math.max(...ringRadii) + DEEP_RIM_MARGIN,
  };
}

export function deepZoneAt(spacing: number, rules: DeepZoneRules, hex: { col: number; row: number }): DeepZone | null {
  if (!isDeepTile(spacing, { ...hex, alt: false })) return null;
  const center = deepCenter(spacing);
  const distance = journeyDistance({ x: center.col, y: center.row }, { x: hex.col, y: hex.row });
  const bounds = deepZoneBounds(rules);
  if (distance < bounds.plazaBelow) return "plaza";
  if (bounds.ringRadii.includes(distance)) return "ring";
  return distance > bounds.rimBeyond ? "rim" : "field";
}
