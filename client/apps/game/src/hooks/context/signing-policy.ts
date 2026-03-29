import type { Chain } from "@contracts";

const resolveSigningDomainChainId = (chain: Chain): "SN_MAIN" | "SN_SEPOLIA" =>
  chain === "mainnet" ? "SN_MAIN" : "SN_SEPOLIA";

export const buildSigningMessages = (chain: Chain) => [
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
      chainId: resolveSigningDomainChainId(chain),
      revision: "1",
    },
  },
];
