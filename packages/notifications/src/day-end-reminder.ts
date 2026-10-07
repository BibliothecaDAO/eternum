import { gamePath, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import type { NotificationLevel } from "./preferences";

/** Legacy Standard includes Important; it remains compatible with the persisted preference hierarchy. */
export const includesDayEndReminder = (level: NotificationLevel): boolean => level !== "off";

/** Clock instants and tomorrow's duration are seconds. Text belongs to the frontend kit. */
export function buildDayEndReminder(input: {
  chainId: string;
  worldAddress: string;
  gameId: number;
  day: number;
  owner: string;
  endsAt: number;
  tomorrowSeconds: number;
}): LocalNotificationPayload {
  const createdAt = (input.endsAt - 3600) * 1000;
  return parseNotificationPayload(
    {
      version: 1,
      kind: "day-end",
      id: `day-end:v1:0x${BigInt(input.chainId).toString(16)}:0x${BigInt(input.worldAddress).toString(16)}:${input.gameId}:${input.day}:${input.owner}`,
      owner: input.owner,
      title: "Day-end reminder",
      body: "Day-end reminder",
      target: gamePath(input),
      createdAt,
      expiresAt: createdAt + 1000,
      dayEnd: { endsAt: input.endsAt, asOf: createdAt / 1000, tomorrowSeconds: input.tomorrowSeconds },
    },
    createdAt,
  );
}
