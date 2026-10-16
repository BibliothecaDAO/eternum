import { storyParticipants } from "@bibliothecadao/eternum/game-client";
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
    participants: storyParticipants,
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
