import React, { useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransactionChains } from "./bridge-tx-chains";
import { RouterOutputs } from "@/router";
import { useExplorer } from "@starknet-react/core";
import { Link } from "@tanstack/react-router";
import { cn, shortenAddress } from "@/utils/utils";
import { ArrowRight } from "lucide-react";
import { useWriteFinalizeWithdrawRealms } from "@/hooks/bridge/useWriteFinalizeWithdrawRealms";
import { toast } from "@/hooks/use-toast";

const BridgeTransactionHistory: React.FC<{
  transactions: RouterOutputs["bridgeTransactions"];
}> = ({ transactions }) => {
  const explorer = useExplorer();
  const { writeAsync, data, isPending: isWithdrawPending } = useWriteFinalizeWithdrawRealms();

  const handleCompleteWithdraw = async (
    transaction: RouterOutputs["bridgeTransactions"][number]
  ) => {
    console.log(transaction);
    const hash = await writeAsync({
      hash: transaction.req_hash,
      l1Address: transaction.to_address,
      l2Address: transaction.from_address,
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
            event.type === "withdraw_completed_l2"
        );

        return (
          <AccordionItem key={transaction.id} value={transaction.id}>
            <AccordionTrigger className="flex hover:no-underline w-full justify-between items-center">
              <div className="flex w-full justify-between px-2">
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <TransactionChains fromChain={transaction.from_chain} />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {transaction.timestamp.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col items-end justify-end">
                  <div className="flex gap-1 ">
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
                      (event) => event.type === "withdraw_available_l1"
                    ) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompleteWithdraw(transaction);
                        // Handle complete withdraw here.
                      }}
                      className="rounded border-green-500 mt-2 z-20"
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
                    isCompleted ? "text-green-500" : "text-yellow-500"
                  )}
                >
                  {isCompleted ? "Completed" : "In Progress"}
                </span>
                <div className="flex items-center gap-2">
                  {shortenAddress(transaction.from_address)}
                  <ArrowRight />
                  {shortenAddress(transaction.to_address)}
                </div>
                <div className="flex items-center gap-2 mt-2">
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

export default BridgeTransactionHistory;
