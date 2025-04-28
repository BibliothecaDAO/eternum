import { XIcon } from "lucide-react";
import { Button } from "../ui/button";

export const SelectNftActions = ({
  selectBatchNfts,
  totalSelectedNfts,
  eligibleTokenIds,
  totalEligibleNfts,
  contractAddress,
  deselectAllNfts,
}: {
  selectBatchNfts: (contractAddress: string, tokenIds: string[]) => void;
  totalSelectedNfts: number;
  eligibleTokenIds: string[];
  totalEligibleNfts: number;
  contractAddress: string;
  deselectAllNfts: () => void;
}) => {
  const isAllSelected = totalEligibleNfts > 0 && totalSelectedNfts === totalEligibleNfts;

  return (
    <div className="flex items-center gap-x-4">
      {isAllSelected ? (
        <Button variant={"secondary"} className="flex" onClick={deselectAllNfts} size="sm">
          Deselect All
          <XIcon className="ml-2 h-4 w-4" />
        </Button>
      ) : (
        <Button
          onClick={() => {
            selectBatchNfts(contractAddress, eligibleTokenIds);
          }}
          size="sm"
          disabled={totalEligibleNfts === 0}
        >
          Select All{totalEligibleNfts > 0 ? ` (${totalEligibleNfts})` : ""}
        </Button>
      )}
    </div>
  );
};
