import { useCallback, useState } from "react";
import { pin } from "@snapshot-labs/pineapple";
import { create } from "ipfs-http-client";

// Define a proper type for the payload instead of using 'any'
export type IPFSPayload = Record<string, unknown>;

export interface PinResult {
  provider: string;
  cid: string;
}

export type PinFunction = (payload: IPFSPayload) => Promise<PinResult>;

function createIpfsPinner(name: string, url: string): PinFunction {
  const client = create({ url });

  return async (payload: IPFSPayload) => {
    const res = await client.add(JSON.stringify(payload), { pin: true });

    return {
      provider: name,
      cid: res.cid.toV0().toString(),
    };
  };
}

const pinGraph = createIpfsPinner(
  "graph",
  "https://api.thegraph.com/ipfs/api/v0",
);

const pinMantle = createIpfsPinner(
  "mantle",
  "https://subgraph-api.mantle.xyz/ipfs",
);

async function pinPineapple(payload: IPFSPayload): Promise<PinResult> {
  const pinned = await pin(payload);
  if (!pinned) throw new Error("Failed to pin");

  return {
    provider: pinned.provider as string,
    cid: pinned.cid as string,
  };
}

export type PinProvider = "graph" | "mantle" | "pineapple";

/**
 * React hook for pinning data to IPFS using different providers
 */
export function useIPFSPin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<PinResult | null>(null);

  const pinToIPFS = useCallback(
    async (
      payload: IPFSPayload,
      provider: PinProvider = "pineapple",
    ): Promise<PinResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        let pinResult: PinResult;

        switch (provider) {
          case "graph":
            pinResult = await pinGraph(payload);
            break;
          case "mantle":
            pinResult = await pinMantle(payload);
            break;
          case "pineapple":
          default:
            pinResult = await pinPineapple(payload);
            break;
        }

        setResult(pinResult);
        return pinResult;
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error("Unknown error while pinning to IPFS");
        setError(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    pinToIPFS,
    isLoading,
    error,
    result,
  };
}
