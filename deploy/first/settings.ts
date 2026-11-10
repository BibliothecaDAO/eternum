import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// Type only: the owner commands start from an export of deploy/first alone (entry.test.ts), so nothing outside it loads.
import type { SocialProvider } from "../../packages/identity/src/account-rules";
import environments from "./environments.json";
import type { SeasonDates } from "./dates";
import { PublicError } from "./errors";

export type Environment = "dev" | "production";
export const root = resolve(import.meta.dir, "../..");
export { environments };
export type Target = (typeof environments)[Environment];
/** The environment's Blitz preset, or null where it runs Frontier only: its book names no Blitz preset. */
export const blitzPresetOf = (target: Target): number | null => ("blitzPreset" in target ? target.blitzPreset : null);
/** A static site the Cloudflare half publishes to Pages: its project and the address that serves it. */
export interface PagesSite {
  pages: string;
  origin: string;
}
/** The game client's site: the environment's own origin, which its Workers' routes share. */
export const clientSite = (target: Target): PagesSite => ({ pages: target.pages, origin: target.origin });
/** Every Pages site of an environment: the game client and the docs, each on its own hostname in the zone. */
export const pagesSites = (target: Target): PagesSite[] => [clientSite(target), target.docs];
export const ACCOUNT_CLASS = "0x540d7f5ec7ecf317e68d48564934cb99259781b1ee3cedbbc37ec5337f8e688";
export const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
export const WEI = 10n ** 18n;
/**
 * Who administers the ledger and pays its funding: the cold admin where the environment keeps one, else the deployer.
 * Every setup and funding step reads it here, so a saved address can never stand in for the deployer by default.
 */
export const ledgerAdmin = (target: Target, inputs: Pick<Inputs, "admin">, deployer: string) =>
  target.coldAdmin ? inputs.admin! : deployer;

/**
 * Each sign-in provider's OAuth client in inputs.json (`googleClientId` and `googleClientSecret`, and so on), which
 * setup's apply installs as the identity Worker's `<PROVIDER>_CLIENT_ID` and `<PROVIDER>_CLIENT_SECRET`. Setup asks only
 * for Discord's; the owner adds the others once their OAuth apps exist, and a provider without its pair is not offered.
 */
type SignInClients = { [P in SocialProvider as `${P}ClientId` | `${P}ClientSecret`]?: string };

/** A provider's half of a pair in inputs.json: `googleClientId` names `google`. */
const SIGN_IN_CLIENT_KEY = /^([a-z]+)Client(?:Id|Secret)$/;

/** The providers inputs.json configures, each with its client; a pair half set or blank is refused, never skipped. */
export const signInClientsOf = (inputs: SignInClients) => {
  const named: Record<string, string | undefined> = inputs;
  const providers = new Set(Object.keys(named).flatMap((key) => SIGN_IN_CLIENT_KEY.exec(key)?.[1] ?? []));
  return [...providers].map((provider) => {
    const clientId = named[`${provider}ClientId`];
    const clientSecret = named[`${provider}ClientSecret`];
    if (!clientId?.trim() || !clientSecret?.trim())
      throw new PublicError(`Set both ${provider}ClientId and ${provider}ClientSecret in inputs.json, or neither`);
    return { provider, clientId, clientSecret };
  });
};

/** The APNs signing key that pushes to the iOS app: its team id, key id and the .p8 file's PEM, all three or none. */
interface ApnsKeyInputs {
  apnsTeamId?: string;
  apnsKeyId?: string;
  apnsPrivateKey?: string;
}

/** The APNs key inputs.json holds, or null; one part set or blank is refused, never skipped. */
export const apnsKeyOf = (inputs: ApnsKeyInputs) => {
  const { apnsTeamId: teamId, apnsKeyId: keyId, apnsPrivateKey: privateKey } = inputs;
  if (teamId === undefined && keyId === undefined && privateKey === undefined) return null;
  if (!teamId?.trim() || !keyId?.trim() || !privateKey?.trim())
    throw new PublicError("Set apnsTeamId, apnsKeyId and apnsPrivateKey in inputs.json, or none of them");
  return { teamId, keyId, privateKey };
};

export interface Inputs extends SeasonDates, SignInClients, ApnsKeyInputs {
  cloudflareToken: string;
  rpc: string;
  cosignerPublicKey: string;
  cosignerUrl: string;
  cosignerToken: string;
  resend: string;
  /** The Discord application players sign in with: every environment offers Discord sign-in. */
  discordClientId: string;
  discordClientSecret: string;
  /**
   * AVNU's paymaster key, which sponsors default wallets' recovery steps. Optional: without it wallets still send and
   * receive, and recovery is refused. Setup never asks for it; the owner adds it to inputs.json.
   */
  avnuPaymasterApiKey?: string;
  /** Where the status monitor emails incidents: production's only, required there and refused on dev. */
  alertEmail?: string;
  amount: string;
  admin?: string;
  treasury?: string;
}
export function addressBook(target: Target): Record<string, string> {
  return JSON.parse(readFileSync(resolve(root, "contracts/common/addresses", target.book), "utf8"));
}
