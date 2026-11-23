import { assertFrontierSeason, CalendarConflict } from "../../apps/launch-service/src/calendar";

import { PublicError } from "./errors";
import { apnsKeyOf, signInClientsOf, type Inputs, type Target } from "./settings";
export interface SeasonDates {
  frontierStart: string;
  frontierEnd: string;
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
  if (start <= 0) throw new PublicError("Each season must end after its explicit start");
  try {
    assertFrontierSeason(start * 1000, end * 1000);
  } catch (error) {
    if (error instanceof CalendarConflict) throw new PublicError(error.message);
    throw error;
  }
}

/** Only production emails incidents: dev's alerts once spent the Resend quota its sign-in codes share. */
const sendsAlerts = (target: Target) => target.environment === "production";

/** Production's treasury receives real value, so it is always named, never the deployer by default. */
const namesTreasury = (target: Target) => target.coldAdmin || target.environment === "production";

/** What setup asks the owner, in order, for this environment. */
export function setupQuestions(target: Target): [keyof Inputs, string][] {
  return [
    ["cloudflareToken", "Cloudflare token"],
    ["rpc", "Alchemy mainnet URL"],
    ["resend", "Resend key"],
    ["cosignerPublicKey", "Independent box co-signer public key (never its private key)"],
    ["cosignerUrl", "Independent box co-signer HTTPS URL"],
    ["cosignerToken", "Co-signer request bearer token"],
    ["discordClientId", "Discord client ID"],
    ["discordClientSecret", "Discord client secret"],
    ...(sendsAlerts(target)
      ? [["alertEmail", "Alert email (where the status monitor reports incidents)"] as [keyof Inputs, string]]
      : []),
    ["frontierStart", "Frontier start, YYYY-MM-DDTHH:MM:SSZ"],
    ["frontierEnd", "Frontier end, YYYY-MM-DDTHH:MM:SSZ"],
    ...(target.coldAdmin
      ? ([["admin", "Public cold admin account address (never its key)"]] as [keyof Inputs, string][])
      : []),
    ...(namesTreasury(target) ? ([["treasury", "Public treasury address"]] as [keyof Inputs, string][]) : []),
  ];
}

export function validateInputs(input: Inputs, target: Target) {
  if (
    !input.cosignerPublicKey ||
    !/^0x[0-9a-fA-F]{1,63}$/.test(input.cosignerPublicKey) ||
    BigInt(input.cosignerPublicKey) <= 0n
  )
    throw new PublicError("Setup needs the independent box co-signer public key");
  if (!input.cosignerToken || !input.cosignerUrl || new URL(input.cosignerUrl).protocol !== "https:")
    throw new PublicError("Setup needs the independent box co-signer HTTPS URL and request token");
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
  signInClientsOf(input);
  apnsKeyOf(input);
  if (input.avnuPaymasterApiKey !== undefined && !input.avnuPaymasterApiKey.trim())
    throw new PublicError("Set avnuPaymasterApiKey to AVNU's paymaster key, or remove it from inputs.json");
  if (!sendsAlerts(target) && input.alertEmail !== undefined)
    throw new PublicError("Dev sends no alert email; remove alertEmail from inputs.json");
  if (sendsAlerts(target) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.alertEmail ?? ""))
    throw new PublicError("Production needs the alert email address");
  validateDates(input);
  if (target.coldAdmin && (!input.admin || BigInt(input.admin) <= 0n))
    throw new PublicError("Production needs the public cold admin and treasury addresses, never their keys");
  if (!target.coldAdmin && input.admin !== undefined)
    throw new PublicError("This environment's ledger admin is its deployer; remove admin from inputs.json");
  if (namesTreasury(target) && (!input.treasury || BigInt(input.treasury) <= 0n))
    throw new PublicError("Production needs its public treasury address, never its key");
}
