import type { Proposal } from "@/gql/graphql";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";

export const ProposalResults = ({ proposal }: { proposal: Proposal }) => {
  return (
    <div className="flex flex-col flex-wrap gap-2">
      <Badge
        variant="outline"
        className="flex justify-between border-success bg-success/10 py-2 hover:bg-success/20"
      >
        <span className="flex items-center">
          <CheckCircle2 className="mr-2 h-5 w-5 text-success" /> Yes:
        </span>
        <span className="text-lg font-bold">{proposal.scores_1 || 0}</span>
      </Badge>

      <Badge
        variant="outline"
        className="flex justify-between border-destructive bg-destructive/10 py-2 hover:bg-destructive/20"
      >
        <span className="flex items-center">
          <XCircle className="mr-2 h-5 w-5 text-destructive" /> No:
        </span>
        <span className="text-lg font-bold">{proposal.scores_2 || 0}</span>
      </Badge>
      <Badge
        variant="outline"
        className="flex justify-between border-muted-foreground bg-muted/20 py-2 hover:bg-muted"
      >
        <span className="flex items-center">
          <MinusCircle className="mr-2 h-5 w-5 text-muted-foreground" /> Abstain:
        </span>
        <span className="text-lg font-bold">{proposal.scores_3 || 0}</span>
      </Badge>
    </div>
  );
};
