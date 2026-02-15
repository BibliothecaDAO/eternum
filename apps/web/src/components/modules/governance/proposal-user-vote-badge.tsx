import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";

export const ProposalUserVoteBadge = ({ choice }: { choice: 1 | 2 | 3 }) => {
  return (
    <>
      {choice === 1 && (
        <Badge
          variant="outline"
          className="flex w-24 rounded border-success py-2 text-success hover:bg-success/20"
        >
          <CheckCircle2 className="mr-2 h-5 w-5 text-success" /> Yes
        </Badge>
      )}

      {choice === 2 && (
        <Badge
          variant="outline"
          className="flex rounded border-destructive bg-destructive/10 py-2 hover:bg-destructive/20"
        >
          <XCircle className="mr-2 h-5 w-5 text-destructive" /> No
        </Badge>
      )}

      {choice === 3 && (
        <Badge
          variant="outline"
          className="flex rounded border-muted-foreground bg-muted/20 py-2 hover:bg-muted"
        >
          <MinusCircle className="mr-2 h-5 w-5 text-muted-foreground" /> Abstain
        </Badge>
      )}
    </>
  );
};
