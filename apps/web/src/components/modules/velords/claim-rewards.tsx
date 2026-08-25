import LordsIcon from "@/components/icons/lords.svg?react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import useVeLordsClaims from "@/hooks/use-velords-claims";
import { formatNumber } from "@/utils/utils";
import Confetti from "react-confetti";
import { formatEther } from "viem";

export const VelordsRewards = () => {
  const {
    recipient,
    setRecipient,
    isRecipientValid,
    claimCall,
    lordsClaimable,
    claimRewards,
    claimIsSubmitting,
  } = useVeLordsClaims();
  const handleClaimRewards = async () => {
    try {
      const hash = await claimRewards();
      toast({
        description: (
          <div className="flex items-center gap-2">
            Claim Lords successful {hash.transaction_hash}
          </div>
        ),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : "Unable to claim rewards.",
      });
    }
  };

  return (
    <Card className="relative overflow-hidden">
      {lordsClaimable && Number(lordsClaimable) > 0 ? (
        <Confetti
          colors={[
            "#f6c297",
            "#f8d0a8",
            "#f4b688",
            "#f7c8a0",
            "#f5c09f",
            "#f9d8b0",
            "#f3ae80",
            "#f2a670",
            "#f1b080",
            "#f0c0a0",
            "#f8e0c0",
            "#f6b090",
          ]}
          opacity={0.5}
          width={600} // Adjust width as needed
          height={300} // Adjust height as needed
          numberOfPieces={100}
          recycle={true}
          gravity={0.055}
        />
      ) : null}
      <CardHeader>
        <CardTitle>Your Claimable Lords</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <LordsIcon className="w-9" />
            <span className="text-3xl font-bold">
              {lordsClaimable &&
                formatNumber(Number(formatEther(lordsClaimable)))}
            </span>{" "}
            Lords to claim
          </div>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button className="p-0" variant={"link"}>
                + Change Recipient
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Input
                placeholder="Recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              {!isRecipientValid && (
                <p className="text-destructive mt-2 text-xs">
                  Enter a valid Starknet recipient address.
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
          <Button
            onClick={handleClaimRewards}
            className="w-full"
            disabled={
              claimIsSubmitting ||
              !isRecipientValid ||
              !claimCall ||
              lordsClaimable <= 0n
            }
          >
            Claim Lords
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          Rewards for veLords are distributed at weekly epochs
        </div>
      </CardFooter>
    </Card>
  );
};
