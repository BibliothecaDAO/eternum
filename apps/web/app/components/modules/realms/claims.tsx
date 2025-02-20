import { useEffect, useState } from "react";
import { ERC721 } from "@/abi/L2/ERC721";
import LordsIcon from "@/components/icons/lords.svg?react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useL2RealmsClaims } from "@/hooks/use-l2-realms-claims";
import { getRealmsLordsClaimsQueryOptions } from "@/lib/getRealms";
import {
  formatNumber,
  shortenAddress,
  SUPPORTED_L2_CHAIN_ID,
} from "@/utils/utils";
import { useAccount, useExplorer, useReadContract } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { formatEther } from "viem";

import { CollectionAddresses } from "@realms-world/constants";

// Define a type for a claim transaction record.
interface ClaimTransaction {
  id: number;
  transactionHash: string;
  date: string;
  amount: string;
  status: string;
}

export const ClaimRewards = () => {
  const { address } = useAccount();
  const lordsPerWeek = 49;
  const pastLordsClaimsQuery = useQuery(
    getRealmsLordsClaimsQueryOptions({ address: address as string }),
  );
  const pastLordsClaims = pastLordsClaimsQuery.data;
  const [claimTransactions, setClaimTransactions] = useState<
    ClaimTransaction[]
  >([]);
  useEffect(() => {
    setClaimTransactions([
      {
        id: 1,
        transactionHash: "0xabc123",
        date: new Date().toLocaleString(),
        amount: "49",
        status: "Successful",
      },
      {
        id: 2,
        transactionHash: "0xdef456",
        date: new Date().toLocaleString(),
        amount: "49",
        status: "Successful",
      },
    ]);
  }, []);

  const { data: realmsBalance } = useReadContract({
    address: CollectionAddresses.realms[SUPPORTED_L2_CHAIN_ID] as `0x${string}`,
    abi: ERC721,
    functionName: "balance_of",
    enabled: !!address,
    args: address ? [address] : undefined,
    refetchInterval: 10000,
  });

  const { balance, isFetching, isSubmitting, claimRewards } =
    useL2RealmsClaims();

  // Handle the claim rewards click event.
  const handleClaimRewards = async () => {
    const hash = await claimRewards();
    // Optionally update the transactions table with the new claim.
    setClaimTransactions((prev) => [
      {
        id: prev.length + 1,
        transactionHash: hash.transaction_hash,
        date: new Date().toLocaleString(),
        amount: formatNumber(Number(formatEther(balance as bigint))),
        status: "Pending", // You might update this once confirmed.
      },
      ...prev,
    ]);
  };
  const explorer = useExplorer();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Realms Claims Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Your Realms on Starknet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <span className="mr-2 text-4xl font-bold">
                {Number(realmsBalance)}
              </span>
            </div>
            <div className="text-muted-foreground flex flex-col gap-2 text-sm">
              <span>
                Realms must be bridged to Starknet and delegated in order to
                receive rewards
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Rewards Information Section */}
        <Card>
          <CardHeader>
            <CardTitle>Rewards Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center gap-2">
              <LordsIcon className="w-9" />
              <span className="text-4xl font-bold">{lordsPerWeek}</span>/ week
            </div>
            <span className="text-muted-foreground text-sm">
              Streamed per block
            </span>
          </CardContent>
        </Card>
      </div>
      {/* Claim Rewards Section */}
      <Card className="w-1/3">
        <CardHeader>
          <CardTitle>Claim Rewards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <LordsIcon className="w-9" />
              <span className="text-3xl font-bold">
                {balance && formatNumber(Number(formatEther(balance)))}
              </span>{" "}
              claimable
            </div>

            <Button
              onClick={handleClaimRewards}
              className="w-full"
              disabled={isSubmitting}
            >
              Claim Lords
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Past Claim Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Past Claim Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Amount (Lords)</th>
                  <th className="px-4 py-2 text-left">Recipient</th>
                  <th className="px-4 py-2 text-left">Transaction Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pastLordsClaims?.map((tx) => (
                  <tr key={tx.hash}>
                    <td className="px-4 py-2">{tx.timestamp}</td>
                    <td className="px-4 py-2">
                      {formatNumber(Number(formatEther(BigInt(tx.amount))))}
                    </td>
                    <td className="px-4 py-2">
                      {shortenAddress(tx.recipient)}
                    </td>
                    <td className="px-4 py-2">
                      <a
                        href={explorer.transaction(tx.hash)}
                        className="flex items-center gap-2 hover:underline"
                        target="_blank"
                      >
                        {shortenAddress(tx.hash)} <ExternalLink />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClaimRewards;
