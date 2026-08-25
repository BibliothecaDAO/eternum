import { useCallback } from "react";
import { env } from "env";
import { StarknetBridgeRealms as L1_REALMS_BRIDGE_ABI } from "@/abi/L1/StarknetBridgeRealms";
import { SUPPORTED_L1_CHAIN_ID } from "@/utils/utils";
import { encodePacked, keccak256, parseGwei, toHex } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import { REALMS_BRIDGE_ADDRESS } from "@realms-world/constants";

const FUNCTION = "depositTokens";
const U128_MASK = (1n << 128n) - 1n;
const LEGACY_FEE_PER_TOKEN_GWEI = 40_000;
const FEE_BUFFER_BPS = 12_000n;

interface StarknetEstimateMessageFeeResponse {
  result?: {
    overall_fee: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

interface StarknetGetClassHashAtResponse {
  result?: string;
  error?: {
    code: number;
    message: string;
  };
}

function splitU256(value: bigint): [bigint, bigint] {
  return [value & U128_MASK, value >> 128n];
}

function serializeDepositPayload({
  salt,
  ownerL1,
  ownerL2,
  tokenIds,
}: {
  salt: bigint;
  ownerL1: `0x${string}`;
  ownerL2: bigint;
  tokenIds: bigint[];
}) {
  const requestHash = BigInt(
    keccak256(
      encodePacked(
        ["uint256", "uint256", "uint256[]"],
        [salt, ownerL2, tokenIds],
      ),
    ),
  );
  const [hashLow, hashHigh] = splitU256(requestHash);
  const serializedTokenIds = tokenIds.flatMap((tokenId) => splitU256(tokenId));

  return [
    hashLow,
    hashHigh,
    BigInt(ownerL1),
    ownerL2,
    BigInt(tokenIds.length),
    ...serializedTokenIds,
  ];
}

async function estimateMessageFeeWei({
  l1BridgeAddress,
  l2BridgeAddress,
  l2BridgeSelector,
  payload,
}: {
  l1BridgeAddress: `0x${string}`;
  l2BridgeAddress: bigint;
  l2BridgeSelector: bigint;
  payload: bigint[];
}) {
  if (!env.VITE_PUBLIC_NODE_URL) {
    throw new Error("Missing Starknet RPC URL for message fee estimation");
  }

  const response = await fetch(env.VITE_PUBLIC_NODE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_estimateMessageFee",
      params: [
        {
          from_address: l1BridgeAddress,
          to_address: toHex(l2BridgeAddress),
          entry_point_selector: toHex(l2BridgeSelector),
          payload: payload.map((felt) => toHex(felt)),
        },
        "latest",
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to estimate Starknet message fee: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as StarknetEstimateMessageFeeResponse;
  if (data.error) {
    throw new Error(
      `Failed to estimate Starknet message fee: ${data.error.message}`,
    );
  }
  if (!data.result?.overall_fee) {
    throw new Error("Invalid Starknet fee estimation response");
  }

  return BigInt(data.result.overall_fee);
}

function applyFeeBuffer(feeWei: bigint) {
  const buffered = (feeWei * FEE_BUFFER_BPS + 9_999n) / 10_000n;
  return buffered > 0n ? buffered : 1n;
}

function isUndeployedAccountError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("contract not found") ||
    normalized.includes("contract address") ||
    normalized.includes("not deployed")
  );
}

export async function isStarknetAccountDeployed(address: string) {
  if (!env.VITE_PUBLIC_NODE_URL) {
    throw new Error("Missing Starknet RPC URL for account deployment check");
  }

  const response = await fetch(env.VITE_PUBLIC_NODE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_getClassHashAt",
      params: ["latest", toHex(BigInt(address))],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to check Starknet account deployment: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as StarknetGetClassHashAtResponse;
  if (data.error) {
    if (isUndeployedAccountError(data.error.message)) {
      return false;
    }
    throw new Error(
      `Failed to check Starknet account deployment: ${data.error.message}`,
    );
  }

  return Boolean(data.result);
}

export function useWriteDepositRealms({
  onSuccess,
}: {
  onSuccess?: (data: unknown) => void;
}) {
  const { address: l1Address } = useAccount();
  const publicClient = usePublicClient({ chainId: SUPPORTED_L1_CHAIN_ID });
  const { writeContractAsync, error, ...writeReturn } = useWriteContract({
    mutation: { onSuccess: (data) => onSuccess?.(data) },
  });

  const writeAsync = useCallback(
    async ({
      tokenIds,
      l2Address,
    }: {
      tokenIds: bigint[];
      l2Address: string;
    }) => {
      if (!l2Address) throw new Error("Missing L2 Address");
      if (!l1Address) throw new Error("Missing L1 Address");
      if (!publicClient) throw new Error("Missing L1 Public Client");
      if (!(await isStarknetAccountDeployed(l2Address))) {
        throw new Error(
          "Your Starknet account is not deployed yet. Send a Starknet transaction first, then bridge.",
        );
      }

      const l1BridgeAddress = REALMS_BRIDGE_ADDRESS[
        SUPPORTED_L1_CHAIN_ID
      ] as `0x${string}`;
      const parsedL2Address = BigInt(l2Address);
      const salt = BigInt(Date.now());
      let value = parseGwei(
        (LEGACY_FEE_PER_TOKEN_GWEI * tokenIds.length).toString(),
      );

      try {
        const [l2BridgeAddress, l2BridgeSelector] =
          await publicClient.readContract({
            address: l1BridgeAddress,
            abi: L1_REALMS_BRIDGE_ABI,
            functionName: "l2Info",
          });

        const payload = serializeDepositPayload({
          salt,
          ownerL1: l1Address,
          ownerL2: parsedL2Address,
          tokenIds,
        });

        value = applyFeeBuffer(
          await estimateMessageFeeWei({
            l1BridgeAddress,
            l2BridgeAddress,
            l2BridgeSelector,
            payload,
          }),
        );
      } catch (feeEstimateError) {
        console.warn(
          "Failed to estimate Starknet L1->L2 message fee, using fallback formula",
          feeEstimateError,
        );
      }

      return await writeContractAsync({
        address: l1BridgeAddress,
        abi: L1_REALMS_BRIDGE_ABI,
        functionName: FUNCTION,
        args: [salt, parsedL2Address, tokenIds],
        value,
      });
    },
    [l1Address, publicClient, writeContractAsync],
  );
  return { writeAsync, error, ...writeReturn };
}
