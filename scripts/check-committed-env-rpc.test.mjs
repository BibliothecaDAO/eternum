import assert from "node:assert/strict";
import { test } from "node:test";
import { findCommittedRpcUrls } from "./check-committed-env-rpc.mjs";

test("a committed public mainnet RPC is found, our own hosts and placeholders are not", () => {
  const findings = findCommittedRpcUrls([
    {
      path: "apps/game/.env",
      text: [
        "VITE_PUBLIC_IDENTITY_RPC_URL=https://api.zan.top/public/starknet-mainnet",
        "RPC_URL=https://starknet-mainnet.public.blastapi.io/rpc/v0_8",
        'IDENTITY_RPC_URL="https://rpc.starknet.lava.build"',
        "GAME_RPC_URL=https://rpc.realms.party/rpc/v0_10_2",
        "IDENTITY_RPC_URL=https://starknet-mainnet.example/rpc/v0_8",
        "VITE_PUBLIC_IDENTITY_RPC_URL=https://identity-rpc.realms.test",
        "GAME_RPC_URL=http://127.0.0.1:5060/rpc/v0_9_0",
        "VITE_PUBLIC_CHAT_URL=https://chat.example.org",
        "VITE_PUBLIC_IDENTITY_RPC_URL=",
      ].join("\n"),
    },
  ]);
  assert.deepEqual(
    findings.map(({ line, key }) => `${line} ${key}`),
    ["1 VITE_PUBLIC_IDENTITY_RPC_URL", "2 RPC_URL", "3 IDENTITY_RPC_URL"],
  );
});
