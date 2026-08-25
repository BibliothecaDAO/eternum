import type { Proposal } from "@/gql/graphql";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useVoteProposal } from "@/hooks/governance/use-vote-proposal";
import { useStarknetWallet } from "@/hooks/use-starknet-wallet";
import { Choice } from "@/types/snapshot";
import { useAccount } from "@starknet-start/react";
import { Check, Minus, X } from "lucide-react";

export const ProposalVoteAction = ({ proposal }: { proposal: Proposal }) => {
  const { vote, selectedChoice, setSelectedChoice } = useVoteProposal(proposal);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [voteReason, setVoteReason] = useState("");
  const proposalTitle =
    ((proposal as { metadata?: { title?: string } }).metadata?.title ??
      "this proposal");
  const { address } = useAccount();
  const { openStarknetKitModal } = useStarknetWallet();

  const openVoteDialog = async (choice: Choice) => {
    if (!address) {
      await openStarknetKitModal();
    }

    setSelectedChoice(choice);
    setVoteReason(
      choice === Choice.For
        ? "I support this proposal"
        : choice === Choice.Against
          ? "I oppose this proposal"
          : "I abstain from this proposal",
    );
    setDialogOpen(true);
  };

  const handleVoteSubmit = async () => {
    if (selectedChoice !== null) {
      await vote(voteReason)
        .then(() => {
          setDialogOpen(false);
        })
        .catch((error) => {
          console.error("Error submitting vote:", error);
        });
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => openVoteDialog(Choice.For)}
          variant="outline"
          size="icon"
          className="rounded-full border-success bg-success/10 hover:bg-success/20"
          title="Vote FOR"
        >
          <Check className="h-5 w-5 text-success" />
        </Button>
        <Button
          onClick={() => openVoteDialog(Choice.Abstain)}
          variant="outline"
          size="icon"
          className="rounded-full border-muted-foreground bg-muted hover:bg-muted/80"
          title="Vote ABSTAIN"
        >
          <Minus className="h-5 w-5 text-muted-foreground" />
        </Button>
        <Button
          onClick={() => openVoteDialog(Choice.Against)}
          variant="outline"
          size="icon"
          className="rounded-full border-destructive bg-destructive/10 hover:bg-destructive/20"
          title="Vote AGAINST"
        >
          <X className="h-5 w-5 text-destructive" />
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Your Vote</DialogTitle>
            <DialogDescription>
              You are voting on: {proposalTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <RadioGroup
              value={selectedChoice?.toString()}
              onValueChange={(value) =>
                setSelectedChoice(Number(value) as Choice)
              }
              className="grid grid-cols-3 gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value={Choice.For.toString()}
                  id="vote-for"
                  className="border-success"
                />
                <Label
                  htmlFor="vote-for"
                  className="flex items-center text-success"
                >
                  <Check className="mr-1 h-4 w-4" /> For
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value={Choice.Abstain.toString()}
                  id="vote-abstain"
                  className="border-muted-foreground"
                />
                <Label
                  htmlFor="vote-abstain"
                  className="flex items-center text-muted-foreground"
                >
                  <Minus className="mr-1 h-4 w-4" /> Abstain
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value={Choice.Against.toString()}
                  id="vote-against"
                  className="border-destructive"
                />
                <Label
                  htmlFor="vote-against"
                  className="flex items-center text-destructive"
                >
                  <X className="mr-1 h-4 w-4" /> Against
                </Label>
              </div>
            </RadioGroup>

            <div className="grid gap-2">
              <Label htmlFor="vote-reason">Reason for your vote</Label>
              <Input
                id="vote-reason"
                value={voteReason}
                onChange={(e) => setVoteReason(e.target.value)}
                placeholder="Enter your reason for voting this way"
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleVoteSubmit}>Submit Vote</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
