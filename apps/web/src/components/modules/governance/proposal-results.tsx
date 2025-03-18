import type { Proposal } from "@/gql/graphql";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";

export const ProposalResults = ({ proposal }: { proposal: Proposal }) => {
  return (
    <div className="flex flex-col flex-wrap gap-2">
      <Badge
        variant="outline"
        className="flex justify-between border-green-600 bg-green-400/10 py-2 hover:bg-green-700"
      >
        <span className="flex items-center">
          <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" /> Yes:
        </span>
        <span className="text-lg font-bold">{proposal.scores_1 || 0}</span>
      </Badge>

      <Badge
        variant="outline"
        className="flex justify-between border-red-500 bg-red-300/20 py-2 hover:bg-red-700"
      >
        <span className="flex items-center">
          <XCircle className="mr-2 h-5 w-5 text-red-500" /> No:
        </span>
        <span className="text-lg font-bold">{proposal.scores_2 || 0}</span>
      </Badge>
      <Badge
        variant="outline"
        className="flex justify-between border-gray-500 bg-gray-100/20 py-2 hover:bg-gray-500"
      >
        <span className="flex items-center">
          <MinusCircle className="mr-2 h-5 w-5 text-gray-500" /> Abstain:
        </span>
        <span className="text-lg font-bold">{proposal.scores_3 || 0}</span>
      </Badge>
    </div>
  );
};
