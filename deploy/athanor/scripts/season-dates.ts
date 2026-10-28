import { assertFrontierSeason } from "../../../apps/launch-service/src/calendar";
import { nativePresetForId } from "../../../config/source/native";
import { clockScaled } from "../../../config/source/common/season-clock";
import { FRONTIER_ARMIES_TICK_SECONDS } from "../../../config/source/frontier/clock";
import { seasonSeconds } from "../../../packages/core/src/utils/days";

interface SeasonRequest {
  presetId: number;
  startsAt: string | null;
  endsAt: string | null;
}

function seasonDates(request: SeasonRequest) {
  const preset = nativePresetForId(request.presetId);
  if (preset.gameType !== "frontier") throw new Error("Select a Frontier preset");
  const scale = preset.clockScale ?? 1;
  const tickMs = clockScaled(FRONTIER_ARMIES_TICK_SECONDS, scale, "armies_tick") * 1_000;
  const bagMs = seasonSeconds(1, clockScaled(preset.dayUnitSeconds, scale, "day_unit_seconds")) * 1_000;
  if ((request.startsAt == null) !== (request.endsAt == null)) throw new Error("Supply both season dates, or neither");
  const start = request.startsAt == null ? Math.floor(Date.now() / tickMs) * tickMs : seasonInstant(request.startsAt);
  const end = request.endsAt == null ? start + bagMs : seasonInstant(request.endsAt);
  assertFrontierSeason(start, end, request.presetId);
  return { presetId: request.presetId, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() };
}

function seasonInstant(value: string): number {
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error("Season dates must be ISO instants with a timezone");
  return Date.parse(value);
}

console.log(JSON.stringify(seasonDates(JSON.parse(process.argv[2]!))));
