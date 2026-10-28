import { assertFrontierSeason, CalendarConflict } from "../../apps/launch-service/src/calendar";

import { PublicError } from "./errors";
import { blitzPresetOf, WEI, type Inputs, type Target } from "./settings";
export interface SeasonDates {
  frontierPresetId: string;
  frontierStart: string;
  frontierEnd: string;
  /** Only where the environment runs Blitz. */
  blitzStart?: string;
  blitzEnd?: string;
}
export function seconds(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value) || !Number.isFinite(Date.parse(value)))
    throw new PublicError("Enter every season date as YYYY-MM-DDTHH:MM:SSZ, without a default");
  if (new Date(value).toISOString().replace(".000Z", "Z") !== value) throw new PublicError("Invalid calendar date");
  return Date.parse(value) / 1000;
}
export function validateDates(dates: SeasonDates, runsBlitz: boolean) {
  if (!/^[1-9][0-9]*$/.test(dates.frontierPresetId ?? ""))
    throw new PublicError("Set frontierPresetId to an explicit registered Frontier preset ID");
  const start = seconds(dates.frontierStart),
    end = seconds(dates.frontierEnd);
  if (start <= 0) throw new PublicError("Each season must end after its explicit start");
  if (runsBlitz) {
    const blitzStart = seconds(dates.blitzStart ?? ""),
      blitzEnd = seconds(dates.blitzEnd ?? "");
    if (blitzStart <= 0 || blitzEnd <= blitzStart)
      throw new PublicError("Each season must end after its explicit start");
  } else if (dates.blitzStart !== undefined || dates.blitzEnd !== undefined)
    throw new PublicError("This environment runs no Blitz; remove blitzStart and blitzEnd from inputs.json");
  try {
    assertFrontierSeason(start * 1000, end * 1000, Number(dates.frontierPresetId));
  } catch (error) {
    if (error instanceof CalendarConflict) throw new PublicError(error.message);
    throw error;
  }
}

/** Only production emails incidents: dev's alerts once spent the Resend quota its sign-in codes share. */
const sendsAlerts = (target: Target) => target.environment === "production";

/** What setup asks the owner, in order, for this environment. */
export function setupQuestions(target: Target): [keyof Inputs, string][] {
  return [
    ["cloudflareToken", "Cloudflare token"],
    ["rpc", "Alchemy mainnet URL"],
    ["resend", "Resend key"],
    ["discordClientId", "Discord client ID"],
    ["discordClientSecret", "Discord client secret"],
    ...(sendsAlerts(target)
      ? [["alertEmail", "Alert email (where the status monitor reports incidents)"] as [keyof Inputs, string]]
      : []),
    ["amount", "Frontier deposit in whole tokens"],
    ["frontierPresetId", "Frontier native preset ID"],
    ["frontierStart", "Frontier start, YYYY-MM-DDTHH:MM:SSZ"],
    ["frontierEnd", "Frontier end, YYYY-MM-DDTHH:MM:SSZ"],
    ...(blitzPresetOf(target) === null
      ? []
      : ([
          ["blitzStart", "Blitz start, YYYY-MM-DDTHH:MM:SSZ"],
          ["blitzEnd", "Blitz end, YYYY-MM-DDTHH:MM:SSZ"],
        ] as [keyof Inputs, string][])),
    ...(target.coldAdmin
      ? ([
          ["admin", "Public cold admin account address (never its key)"],
          ["treasury", "Public treasury address"],
        ] as [keyof Inputs, string][])
      : []),
  ];
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
  if (!input.discordClientId || !input.discordClientSecret)
    throw new PublicError("Discord sign-in needs its client ID and secret in inputs.json");
  if (!sendsAlerts(target) && input.alertEmail !== undefined)
    throw new PublicError("Dev sends no alert email; remove alertEmail from inputs.json");
  if (sendsAlerts(target) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.alertEmail ?? ""))
    throw new PublicError("Production needs the alert email address");
  if (!/^[1-9][0-9]*$/.test(input.amount) || BigInt(input.amount) * WEI >= 1n << 128n)
    throw new PublicError("Deposit must be positive whole tokens fitting u128 wei");
  validateDates(input, blitzPresetOf(target) !== null);
  if (
    target.coldAdmin &&
    (!input.admin || !input.treasury || BigInt(input.admin) <= 0n || BigInt(input.treasury) <= 0n)
  )
    throw new PublicError("Production needs the public cold admin and treasury addresses, never their keys");
}
