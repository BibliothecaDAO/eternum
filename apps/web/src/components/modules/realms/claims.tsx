import { useState } from "react";
import { ERC721 } from "@/abi/L2/ERC721";
import LordsIcon from "@/components/icons/lords.svg?react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useL2RealmsClaims } from "@/hooks/use-l2-realms-claims";
import { getRealmsLordsClaimsQueryOptions } from "@/lib/getRealmsLordsClaims";
import {
  formatNumber,
  shortenAddress,
  SUPPORTED_L2_CHAIN_ID,
} from "@/utils/utils";
import { useAccount, useExplorer, useReadContract } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import Confetti from "react-confetti";
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
  const pastLordsClaimsQuery = useQuery(
    getRealmsLordsClaimsQueryOptions({ address: address as string }),
  );
  const pastLordsClaims = pastLordsClaimsQuery.data;
  /*const [claimTransactions, setClaimTransactions] = useState<
    ClaimTransaction[]
  >([]);*/

  const { balance, isSubmitting, claimRewards } = useL2RealmsClaims();

  // Handle the claim rewards click event.
  const handleClaimRewards = async () => {
    await claimRewards();
    // Optionally update the transactions table with the new claim.
    /*setClaimTransactions((prev) => [
      {
        id: prev.length + 1,
        transactionHash: hash.transaction_hash,
        date: new Date().toLocaleString(),
        amount: formatNumber(Number(formatEther(balance as bigint))),
        status: "Pending", // You might update this once confirmed.
      },
      ...prev,
    ]);*/
  };
  const explorer = useExplorer();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Past Realms Claims Dashboard</h1>
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Claim Rewards Section */}
        <Card className="relative overflow-hidden">
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
        {/* Rewards Info Section */}
        <Card className="relativeoverflow-hidden">
          <CardHeader>
            <CardTitle>Lords Rewards have ended!</CardTitle>
          </CardHeader>
          <CardContent>
            The Realms DAO voted to end weekly Lords Rewards in{" "}
            <a href="https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62/proposal/53">
              BIP-80 and the Lords have now been directed to game rewards for
              Eterenum seasons
            </a>
          </CardContent>
        </Card>
      </div>
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
