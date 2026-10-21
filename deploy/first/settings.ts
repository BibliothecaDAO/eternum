import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import environments from "./environments.json";
import type { SeasonDates } from "./dates";

export type Environment = "dev" | "production";
export const root = resolve(import.meta.dir, "../..");
export { environments };
export type Target = (typeof environments)[Environment];
export const ACCOUNT_CLASS = "0x540d7f5ec7ecf317e68d48564934cb99259781b1ee3cedbbc37ec5337f8e688";
export const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
export const WEI = 10n ** 18n;
export interface Inputs extends SeasonDates {
  cloudflareToken: string;
  rpc: string;
  resend: string;
  /** The Discord application players sign in with: every environment offers Discord sign-in. */
  discordClientId: string;
  discordClientSecret: string;
  /** Where the status monitor emails incidents: production's only, required there and refused on dev. */
  alertEmail?: string;
  amount: string;
  admin?: string;
  treasury?: string;
}
export function addressBook(target: Target): Record<string, string> {
  return JSON.parse(readFileSync(resolve(root, "contracts/common/addresses", target.book), "utf8"));
}
