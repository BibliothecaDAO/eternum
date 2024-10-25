import { XIcon } from "lucide-react";
import { Button } from "../ui/button";

export const SelectNftActions = ({
  selectedTokenIds,
  selectBatchNfts,
  totalSelectedNfts,
  batchTokenIds,
  contractAddress,
  deselectAllNfts,
}: {
  selectedTokenIds: string[];
  selectBatchNfts: (contractAddress: string, tokenIds: string[]) => void;
  totalSelectedNfts: number;
  batchTokenIds?: string[];
  contractAddress: string;
  deselectAllNfts: () => void;
}) => {
  const isAllSelected = totalSelectedNfts === batchTokenIds?.length;

  let batchData: { contractAddress: string; tokenIds: string[] };
  if (batchTokenIds?.[0]) {
    batchData = {
      contractAddress: contractAddress,
      tokenIds: batchTokenIds,
    };
  }
  return (
    <div className="flex items-center gap-x-4">
      {isAllSelected ? (
        <Button variant={"secondary"} className="flex" onClick={deselectAllNfts} size="sm">
          Deselect All
          <XIcon className="ml-2" />
        </Button>
      ) : (
        <Button
          onClick={() => {
            selectBatchNfts(batchData.contractAddress, batchData.tokenIds);
          }}
          size="sm"
        >
          Select All
        </Button>
      )}
    </div>
  );
};
