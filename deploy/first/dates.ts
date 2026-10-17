import { assertFrontierSeason, CalendarConflict } from "../../apps/launch-service/src/calendar";

import { PublicError } from "./errors";
import { WEI, type Inputs, type Target } from "./settings";
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

export function validateInputs(input: Inputs, target: Target) {
  const rpc = new URL(input.rpc);
  if (
    rpc.protocol !== "https:" ||
    rpc.hostname !== "starknet-mainnet.g.alchemy.com" ||
    rpc.username ||
    rpc.password ||
    rpc.hash
  )
    throw new PublicError("Use the Alchemy mainnet HTTPS endpoint");
  if (!input.cloudflareToken || !input.resend) throw new PublicError("Cloudflare and Resend credentials are required");
  if (input.alertEmail !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.alertEmail))
    throw new PublicError("The alert email must be an email address");
  if (!/^[1-9][0-9]*$/.test(input.amount) || BigInt(input.amount) * WEI >= 1n << 128n)
    throw new PublicError("Deposit must be positive whole tokens fitting u128 wei");
  validateDates(input);
  if (
    target.coldAdmin &&
    (!input.admin || !input.treasury || BigInt(input.admin) <= 0n || BigInt(input.treasury) <= 0n)
  )
    throw new PublicError("Production needs the public cold admin and treasury addresses, never their keys");
}
