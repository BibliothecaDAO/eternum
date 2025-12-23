import type { Chain, WorldProfile } from "@bibliothecadao/world";
import { buildWorldProfile as buildWorldProfileShared, toriiBaseUrlFromName } from "@bibliothecadao/world";
import { env } from "../../../env";

export const buildWorldProfile = async (chain: Chain, name: string): Promise<WorldProfile> =>
  buildWorldProfileShared(chain, name, { cartridgeApiBase: env.VITE_PUBLIC_CARTRIDGE_API_BASE });

export { toriiBaseUrlFromName };
