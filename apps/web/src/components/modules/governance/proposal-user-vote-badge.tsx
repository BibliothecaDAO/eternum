import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";

export const ProposalUserVoteBadge = ({ choice }: { choice: 1 | 2 | 3 }) => {
  return (
    <>
      {choice === 1 && (
        <Badge
          variant="outline"
          className="flex w-24 rounded border-green-600 py-2 text-green-400 hover:bg-green-700"
        >
          <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" /> Yes
        </Badge>
      )}

      {choice === 2 && (
        <Badge
          variant="outline"
          className="flex rounded border-red-500 bg-red-300/20 py-2 hover:bg-red-700"
        >
          <XCircle className="mr-2 h-5 w-5 text-red-500" /> No
        </Badge>
      )}

      {choice === 3 && (
        <Badge
          variant="outline"
          className="flex rounded border-gray-500 bg-gray-100/20 py-2 hover:bg-gray-500"
        >
          <MinusCircle className="mr-2 h-5 w-5 text-gray-500" /> Abstain
        </Badge>
      )}
    </>
  );
};
