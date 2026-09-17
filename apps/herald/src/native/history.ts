import type { NativeSchema } from "./schema";
import type { HistoryCodec } from "../history-store";

const activities = {
  Exploration: "exploration",
  RelicChest: "openRelicChest",
  HyperstructureCapture: "hyperStructureBanditsDefeat",
  StructureCapture: "otherStructureBanditsDefeat",
  Hyperstructure: "hyperstructureShare",
} as const;

export function createNativeHistoryCodec(schema: NativeSchema): HistoryCodec {
  return {
    storyModels: schema.events.map(({ name }) => name),
    pointsModel: "PointsAwarded",
    participants: historyParticipants,
    readPoints: readPointAward,
  };
}

function readPointAward(value: Record<string, unknown>) {
  if (!Object.hasOwn(value, "activity")) return null;
  const activity = String(value.activity);
  if (!Object.hasOwn(activities, activity)) throw new Error(`Unknown native point activity ${activity}`);
  const player = BigInt(String(value.player));
  const points = BigInt(String(value.points));
  if (player <= 0n || points < 0n) throw new Error("Invalid native points award");
  return {
    address: `0x${player.toString(16)}`,
    points: Number(points) / 1_000_000,
    activity: activities[activity as keyof typeof activities],
  };
}

function historyParticipants(value: Record<string, unknown>) {
  const side = (name: string): Record<string, unknown> => {
    const candidate = value[name];
    return candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : {};
  };
  const scalars = (values: unknown[], hex: boolean) => [
    ...new Set(
      values
        .filter((value) => value !== undefined && value !== null)
        .map((value) => BigInt(String(value)))
        .filter((value) => value !== 0n)
        .map((value) => (hex ? `0x${value.toString(16)}` : value.toString())),
    ),
  ];
  return {
    owners: scalars(
      [value.owner, value.player, value.target_owner, side("attacker").player, side("defender").player],
      true,
    ),
    entities: scalars(
      [value.entity_id, value.explorer_id, value.structure_id, value.attacker_id, value.defender_id],
      false,
    ),
  };
}
