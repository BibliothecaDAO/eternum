import type { Chain } from "@contracts";

const resolveSigningChainId = (chain: Chain): "SN_MAIN" | "SN_SEPOLIA" => {
  return chain === "mainnet" ? "SN_MAIN" : "SN_SEPOLIA";
};

// The offchain-message typed data only exists on the legacy worlds (there is
// no s2 Message model, and appchain chat is disabled) — announcing an
// SN_SEPOLIA signing domain on the appchain was simply wrong. No messages.
export const buildSigningMessages = (chain: Chain) => {
  if (chain === "appchain" || chain === "local") return [];
  return buildLegacySigningMessages(chain);
};

const buildLegacySigningMessages = (chain: Chain) => [
  {
    name: "Eternum Message Signing",
    description: "Allows signing messages for Eternum",
    types: {
      StarknetDomain: [
        { name: "name", type: "shortstring" },
        { name: "version", type: "shortstring" },
        { name: "chainId", type: "shortstring" },
        { name: "revision", type: "shortstring" },
      ],
      "s1_eternum-Message": [
        { name: "identity", type: "ContractAddress" },
        { name: "channel", type: "shortstring" },
        { name: "content", type: "string" },
        { name: "timestamp", type: "felt" },
        { name: "salt", type: "felt" },
      ],
    },
    primaryType: "s1_eternum-Message",
    domain: {
      name: "Eternum",
      version: "1",
      chainId: resolveSigningChainId(chain),
      revision: "1",
    },
  },
];
