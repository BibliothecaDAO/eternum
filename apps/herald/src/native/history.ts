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
  const payload = historyRecord(Object.values(historyRecord(value.story))[0]);
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
      [
        value.owner,
        value.player,
        value.target_owner,
        historyRecord(value.attacker).player,
        historyRecord(value.defender).player,
        payload.owner,
        payload.winner,
        payload.previous_owner,
        payload.new_owner,
        payload.from_entity_owner_address,
        payload.to_entity_owner_address,
      ],
      true,
    ),
    entities: scalars(
      [
        value.entity_id,
        value.explorer_id,
        value.structure_id,
        value.attacker_id,
        value.defender_id,
        payload.explorer_id,
        payload.structure_id,
        payload.from_entity_id,
        payload.to_entity_id,
        payload.bank_id,
        payload.mine_id,
        armyEntity(payload.source),
        armyEntity(payload.target),
      ],
      false,
    ),
  };
}

function historyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function armyEntity(value: unknown): unknown {
  const army = historyRecord(value);
  return army.Explorer ?? historyRecord(army.Guard).structure_id;
}
