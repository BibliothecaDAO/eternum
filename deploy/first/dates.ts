import { assertFrontierSeason, CalendarConflict } from "../../apps/launch-service/src/calendar";

export class PublicError extends Error {}
export interface SeasonDates {
  frontierStart: string;
  frontierEnd: string;
  blitzStart: string;
  blitzEnd: string;
}
export function seconds(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value) || !Number.isFinite(Date.parse(value)))
    throw new PublicError("Enter every season date as YYYY-MM-DDTHH:MM:SSZ, without a default");
  if (new Date(value).toISOString().replace(".000Z", "Z") !== value) throw new PublicError("Invalid calendar date");
  return Date.parse(value) / 1000;
}
export function validateDates(dates: SeasonDates) {
  const start = seconds(dates.frontierStart),
    end = seconds(dates.frontierEnd);
  const blitzStart = seconds(dates.blitzStart),
    blitzEnd = seconds(dates.blitzEnd);
  if (start <= 0 || blitzStart <= 0 || blitzEnd <= blitzStart)
    throw new PublicError("Each season must end after its explicit start");
  try {
    assertFrontierSeason(start * 1000, end * 1000);
  } catch (error) {
    if (error instanceof CalendarConflict) throw new PublicError(error.message);
    throw error;
  }
}
