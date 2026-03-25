import { ec, stark } from "starknet";

import type { CartridgeApprovalResult } from "../types";

export async function buildCartridgeApprovalUrl(input: {
  keychainUrl: string;
  rpcUrl: string;
  redirectUri: string;
  policies: Record<string, unknown>;
}): Promise<CartridgeApprovalResult> {
  const privateKey = stark.randomAddress();
  const publicKey = ec.starkCurve.getStarkKey(privateKey);
  const authUrl = new URL("/session", input.keychainUrl);

  authUrl.searchParams.set("public_key", publicKey);
  authUrl.searchParams.set("redirect_uri", input.redirectUri);
  authUrl.searchParams.set("redirect_query_name", "startapp");
  authUrl.searchParams.set("policies", JSON.stringify(input.policies));
  authUrl.searchParams.set("rpc_url", input.rpcUrl);

  return {
    authUrl: authUrl.toString(),
    signer: {
      privKey: privateKey,
      pubKey: publicKey,
    },
    sessionRef: publicKey,
  };
}
