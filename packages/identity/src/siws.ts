import type { ISiwsDomain, ISiwsMessage } from "@realms-world/siws";
import { SiwsTypedData } from "@realms-world/siws";

import type { IdentityChainId } from "./types";

export interface BuildSiwsMessageOptions {
  address: string;
  chainId: IdentityChainId;
  domain: string;
  nonce: string;
  statement?: string;
  uri: string;
  issuedAt?: string;
}

export const buildSiwsMessage = ({
  address,
  chainId,
  domain,
  nonce,
  statement = "Login to Realms.World with your Starknet wallet",
  uri,
  issuedAt = new Date().toISOString(),
}: BuildSiwsMessageOptions): SiwsTypedData => {
  const siwsDomain: ISiwsDomain = {
    version: "0.0.1",
    chainId,
    name: domain,
    revision: "1",
  };
  const siwsMessage: ISiwsMessage = {
    address,
    statement,
    uri,
    version: "0.0.5",
    nonce,
    issuedAt,
  };

  return new SiwsTypedData(siwsDomain, siwsMessage);
};
