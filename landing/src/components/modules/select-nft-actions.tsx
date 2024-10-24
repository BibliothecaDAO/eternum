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
  /*const { toggleNftBridge, setNftBridgeModalProps } = useUIStore(
    (state) => state,
  );*/
  const isAllSelected = totalSelectedNfts === batchTokenIds?.length;

  let batchData: { contractAddress: string; tokenIds: string[] };
  if (batchTokenIds?.[0]) {
    batchData = {
      contractAddress: contractAddress,
      tokenIds: batchTokenIds,
    };
  }
  return (
    <div className="my-2 flex w-full justify-between">
      {/*<div className="flex items-center gap-x-4">
        <span className="text-lg">Actions:</span>
        <Button
          onClick={() => {
            setNftBridgeModalProps({
              selectedTokenIds: selectedTokenIds,
              sourceChain: sourceChain,
            });
            toggleNftBridge();
          }}
          disabled={totalSelectedNfts < 1}
        >
          <Bridge className="mr-2 w-6" />
          Bridge
        </Button>
        </div>*/}
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
            color="default"
            size="sm"
          >
            Select All
          </Button>
        )}
      </div>
    </div>
  );
};
