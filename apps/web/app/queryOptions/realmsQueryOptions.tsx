import { queryOptions } from "@tanstack/react-query";
import { getPortfolioTokens } from "@/lib/ark/getPortfolioTokens";
import { ArkClient } from "@/lib/ark/client";

export const realmsQueryOptions = ({
  walletAddress,
  client,
  collectionAddress
}: {
  walletAddress: string;
  collectionAddress?: string;
  client: ArkClient;
}) =>
  queryOptions({
    queryKey: ["realms" + walletAddress + collectionAddress],
    queryFn: () => getPortfolioTokens({walletAddress, client, collectionAddress}),
  });
