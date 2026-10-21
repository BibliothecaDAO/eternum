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

/** Only production emails incidents: dev's alerts once spent the Resend quota its sign-in codes share. */
const sendsAlerts = (target: Target) => target.environment === "production";

/** What setup asks the owner, in order, for this environment. */
export function setupQuestions(target: Target): [keyof Inputs, string][] {
  return [
    ["cloudflareToken", "Cloudflare token"],
    ["rpc", "Alchemy mainnet URL"],
    ["resend", "Resend key"],
    ["discordClientId", "Discord client ID (empty for no Discord sign-in)"],
    ["discordClientSecret", "Discord client secret (empty for no Discord sign-in)"],
    ...(sendsAlerts(target)
      ? [["alertEmail", "Alert email (where the status monitor reports incidents)"] as [keyof Inputs, string]]
      : []),
    ["amount", "Frontier deposit in whole tokens"],
    ["frontierStart", "Frontier start, YYYY-MM-DDTHH:MM:SSZ"],
    ["frontierEnd", "Frontier end, YYYY-MM-DDTHH:MM:SSZ"],
    ["blitzStart", "Blitz start, YYYY-MM-DDTHH:MM:SSZ"],
    ["blitzEnd", "Blitz end, YYYY-MM-DDTHH:MM:SSZ"],
    ...(target.coldAdmin
      ? ([
          ["admin", "Public cold admin account address (never its key)"],
          ["treasury", "Public treasury address"],
        ] as [keyof Inputs, string][])
      : []),
  ];
}

/** Discord sign-in is chosen in every environment: both values, or both empty for none. */
function validateDiscord(input: Inputs) {
  if (typeof input.discordClientId !== "string" || typeof input.discordClientSecret !== "string")
    throw new PublicError(
      "Choose Discord sign-in: set discordClientId and discordClientSecret in inputs.json, both empty for none",
    );
  if (!input.discordClientId !== !input.discordClientSecret)
    throw new PublicError("Discord sign-in needs both its client ID and secret, or neither");
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
  validateDiscord(input);
  if (!sendsAlerts(target) && input.alertEmail !== undefined)
    throw new PublicError("Dev sends no alert email; remove alertEmail from inputs.json");
  if (sendsAlerts(target) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.alertEmail ?? ""))
    throw new PublicError("Production needs the alert email address");
  if (!/^[1-9][0-9]*$/.test(input.amount) || BigInt(input.amount) * WEI >= 1n << 128n)
    throw new PublicError("Deposit must be positive whole tokens fitting u128 wei");
  validateDates(input);
  if (
    target.coldAdmin &&
    (!input.admin || !input.treasury || BigInt(input.admin) <= 0n || BigInt(input.treasury) <= 0n)
  )
    throw new PublicError("Production needs the public cold admin and treasury addresses, never their keys");
}
