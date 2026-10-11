import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import environments from "./environments.json";
import { validateDates, type SeasonDates } from "./dates";

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
  amount: string;
  admin?: string;
  treasury?: string;
}
export function addressBook(target: Target): Record<string, string> {
  return JSON.parse(readFileSync(resolve(root, "contracts/common/addresses", target.book), "utf8"));
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
    throw new Error("Use the Alchemy mainnet HTTPS endpoint");
  if (!input.cloudflareToken || !input.resend) throw new Error("Cloudflare and Resend credentials are required");
  if (!/^[1-9][0-9]*$/.test(input.amount) || BigInt(input.amount) * WEI >= 1n << 128n)
    throw new Error("Deposit must be positive whole tokens fitting u128 wei");
  validateDates(input);
  if (
    target.coldAdmin &&
    (!input.admin || !input.treasury || BigInt(input.admin) <= 0n || BigInt(input.treasury) <= 0n)
  )
    throw new Error("Production needs the public cold admin and treasury addresses, never their keys");
}
