import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWriteFinalizeWithdrawRealms } from "@/hooks/bridge/useWriteFinalizeWithdrawRealms";
import { useToast } from "@/hooks/use-toast";
import { getBridgeTransactionsQueryOptions } from "@/lib/getBridgeTransactions";
import { cn, shortenAddress } from "@/utils/utils";
import { useAccount, useExplorer } from "@starknet-react/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useAccount as useL1Account } from "wagmi";

import { TransactionChains } from "./bridge-tx-chains";

const BridgeTransactionItems = () => {
  const explorer = useExplorer();
  const { writeAsync, isPending: isWithdrawPending } =
    useWriteFinalizeWithdrawRealms();

  const { address: l1Address } = useL1Account();
  const { address: l2Address } = useAccount();
  const { toast } = useToast();

  const bridgeTxsQuery = useSuspenseQuery(
    getBridgeTransactionsQueryOptions({
      l1Account: l1Address?.toLowerCase(),
      l2Account: l2Address,
    }),
  );
  const transactions = bridgeTxsQuery.data;

  const handleCompleteWithdraw = async (transaction: {
    token_ids: number[];
    from_address: string;
    to_address: string;
    req_hash: string;
  }) => {
    const hash = await writeAsync({
      hash: transaction.req_hash,
      l1Address: transaction.from_address,
      l2Address: transaction.to_address,
      tokenIds: transaction.token_ids.map((id) => BigInt(id)),
    });
    if (hash) {
      toast({
        title: "Withdraw completed",
        description: `Realms withdrawn to your Ethereum account at ${hash}`,
      });
    }
  };
  return (
    <Accordion type="single" collapsible>
      {transactions?.map((transaction) => {
        const isCompleted = transaction.events.some(
          (event) =>
            event.type === "withdraw_completed_l1" ||
            event.type === "withdraw_completed_l2",
        );

        return (
          <AccordionItem key={transaction.id} value={transaction.id}>
            <AccordionTrigger className="flex w-full items-center justify-between hover:no-underline">
              <div className="flex w-full justify-between px-2">
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <TransactionChains fromChain={transaction.from_chain} />
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {transaction.timestamp.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col items-end justify-end">
                  <div className="flex gap-1">
                    {transaction.token_ids.slice(0, 3).map((id) => (
                      <Badge variant="outline" className="w-fit" key={id}>
                        #{id}
                      </Badge>
                    ))}
                    {transaction.token_ids.length > 3 && (
                      <Badge key="more">
                        +{transaction.token_ids.length - 3}
                      </Badge>
                    )}
                  </div>
                  {isCompleted ? (
                    <span className="text-muted-foreground">Completed</span>
                  ) : transaction.events.some(
                      (event) => event.type === "withdraw_available_l1",
                    ) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await handleCompleteWithdraw(transaction);
                      }}
                      className="z-20 mt-2 rounded border-green-500"
                      disabled={isWithdrawPending}
                    >
                      Complete Withdraw
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">In Progress</span>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col space-y-1 py-2">
                <span
                  className={cn(
                    isCompleted ? "text-green-500" : "text-yellow-500",
                  )}
                >
                  {isCompleted ? "Completed" : "In Progress"}
                </span>
                <div className="flex items-center gap-2">
                  {shortenAddress(transaction.from_address)}
                  <ArrowRight />
                  {shortenAddress(transaction.to_address)}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {transaction.events.map((event, idx) => {
                    const explorerLink = event.type.endsWith("l2")
                      ? explorer.transaction(event.hash)
                      : "https://sepolia.etherscan.io/tx/" + event.hash;
                    return (
                      <Link to={explorerLink} target="_blank">
                        <Button variant="outline" key={event.hash + idx}>
                          {event.type.endsWith("l2")
                            ? "Starkscan"
                            : "Etherscan"}
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

export default BridgeTransactionItems;
