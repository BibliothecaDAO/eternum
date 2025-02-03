import { CollectionAddresses, ChainId } from "@realms-world/constants";
import type { paths } from "@reservoir0x/reservoir-sdk";
import { useSuspenseQuery } from "@tanstack/react-query";
import { env } from "env";

export const useL1Tokens = ({
  address,
  continuation,
}: {
  address?: string;
  continuation?: string;
}) => {
  const queryString = continuation ? `&continuation=${continuation}` : "";
  const RESERVOIR_API_URL = `https://api${env.VITE_PUBLIC_CHAIN === "sepolia" ? "-sepolia" : ""
  }.reservoir.tools`;
  const url = `/api/users/${address}/tokens/v10?collection=${CollectionAddresses.realms[ChainId.MAINNET]?.toLowerCase()}${queryString}&limit=24`;

  return useSuspenseQuery({
    queryKey: ["userTokens" + address],
    queryFn: async () =>
      await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.VITE_PUBLIC_RESERVOIR_API_KEY,
          "Access-Control-Allow-Origin": "*",
        },
      })
        .then((res) => res.json())
        .then((res) => {
          return res as paths["/users/{user}/tokens/v10"]["get"]["responses"]["200"]["schema"];
        }),
    refetchInterval: 15000,
  });

};
