import type { RealmsWithdrawal } from "@/types/subgraph";
import type { TransactionFinalityStatus } from "starknet";
import { useQuery } from "@tanstack/react-query";
import { env } from "env";

const query = `query Withdrawals(
    $l1Address: String
    $status: [String]
  ) {
    withdrawals(
      where: {
        l1Recipient: $l1Address
        withdrawalEvents_: {status_in: $status}
      }
      orderBy: createdTimestamp
      orderDirection: desc
    ) {
      id
      req_hash
      l2Sender
      l1Recipient
      createdTimestamp
      withdrawalEvents {
        id
        status
        l1Recipient
        tokenIds
        createdTxHash
        finishedTxHash
        finishedAtDate
      }
    }
  }
  `;

export const usePendingRealmsWithdrawals = ({
  address,
  status,
}: {
  address?: string;
  status?: TransactionFinalityStatus;
}) => {
  const variables: { l1Address?: string; status?: string[] } = {};
  if (address) {
    variables.l1Address = address.toLowerCase();
  }
  if (status) {
    variables.status = [status];
  } else {
    variables.status = ["ACCEPTED_ON_L1", "FINISHED"];
  }

  return useQuery({
    queryKey: ["pendingRealmsWithdrawals" + address + status],
    queryFn: async () =>
      await fetch(env.NEXT_PUBLIC_REALMS_BRIDGE_SUBGRAPH_NAME, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: variables,
        }),
      })
        .then((res) => res.json())
        .then((res: { data?: { withdrawals: RealmsWithdrawal[] } }) => {
          return res.data?.withdrawals;
        }),
    enabled: !!address,
  });
};
