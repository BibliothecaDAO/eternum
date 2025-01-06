import { env } from "../../../env";

export const signingPolicy = [
  {
    types: {
      StarknetDomain: [
        { name: "name", type: "shortstring" },
        { name: "version", type: "shortstring" },
        { name: "chainId", type: "shortstring" },
        { name: "revision", type: "shortstring" },
      ],
      "s0_eternum-Message": [
        { name: "identity", type: "ContractAddress" },
        { name: "channel", type: "shortstring" },
        { name: "content", type: "string" },
        { name: "timestamp", type: "felt" },
        { name: "salt", type: "felt" },
      ],
    },
    primaryType: "s0_eternum-Message",
    domain: {
      name: "Eternum",
      version: "1",
      chainId: env.VITE_PUBLIC_CHAIN == "mainnet" ? "SN_MAIN" : "SN_SEPOLIA",
      revision: "1",
    },
  },
];
