import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccount, useContract, useSendTransaction } from "@starknet-react/core";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent } from "../ui/dialog";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { Input } from "../ui/input";

import { abi } from "@/abi/SeasonPass";
import { marketplaceCollections } from "@/config";
import { displayAddress } from "@/lib/utils";
import { MergedNftData, RealmMetadata } from "@/types";
import { useCartridgeAddress, useDebounce } from "@bibliothecadao/react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { TypeH3 } from "../typography/type-h3";

interface TransferNftDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  nfts: MergedNftData[];
  collectionName: string;
  collectionAddress: string;
  initialSelectedTokenId?: string | null;
}

export default function TransferNftDialog({
  isOpen,
  setIsOpen,
  nfts,
  collectionName,
  collectionAddress,
  initialSelectedTokenId,
}: TransferNftDialogProps) {
  const [input, setInput] = useState<string>("");
  const debouncedInput = useDebounce(input, 500); // 500ms delay

  const [transferTo, setTransferTo] = useState<string | null>(null);
  const [selectedTokens, setSelectedTokens] = useState<string[]>(
    initialSelectedTokenId ? [initialSelectedTokenId] : [],
  );
  const [isCopied, setIsCopied] = useState(false);

  const toggleTokenSelection = (tokenId: string) => {
    setSelectedTokens((prev) => {
      if (prev.includes(tokenId)) {
        return prev.filter((id) => id !== tokenId);
      } else {
        return [...prev, tokenId];
      }
    });
  };

  const { address } = useAccount();
  const { contract } = useContract({
    abi,
    address: collectionAddress as `0x${string}`,
  });

  const { address: cartridgeAddress, fetchAddress, loading: cartridgeLoading, name } = useCartridgeAddress();

  const { sendAsync, error } = useSendTransaction({
    calls:
      contract && address && transferTo
        ? selectedTokens.map((tokenId) => {
            console.log("Creating transfer call for tokenId:", tokenId, "from:", address, "to:", transferTo);
            return contract.populate("transfer_from", [address, BigInt(transferTo || ""), tokenId]);
          })
        : undefined,
  });

  const handleTransfer = async () => {
    if (!transferTo || selectedTokens.length === 0) return;
    setIsOpen(false);
    const tx = await sendAsync();
    console.log(tx);
    if (tx) {
      setInput("");
      setSelectedTokens([]);
      setTransferTo(null);
    }
  };

  useEffect(() => {
    const validateAndSetTransferAddress = async () => {
      if (!debouncedInput) {
        setTransferTo(null);
        return;
      }

      // Reset transferTo initially
      setTransferTo(null);

      await fetchAddress(debouncedInput);

      if (cartridgeAddress) {
        setTransferTo(cartridgeAddress);
      } else {
        // Check if the input looks like a Starknet address (hex)
        if (debouncedInput.startsWith("0x") && debouncedInput.length === 66) {
          setTransferTo(debouncedInput);
        } else {
          // Check if the input can be converted to a BigInt (decimal or other valid format)
          try {
            BigInt(debouncedInput);
            // If conversion succeeds, set it as the transfer target
            setTransferTo(debouncedInput);
          } catch (e) {
            // If conversion fails, transferTo remains null
          }
        }
      }
    };

    validateAndSetTransferAddress();
  }, [debouncedInput, cartridgeAddress, fetchAddress]);

  const toggleAllTokens = () => {
    if (selectedTokens.length === nfts.length) {
      // If all tokens are selected, deselect all
      setSelectedTokens([]);
    } else {
      // Select all tokens
      setSelectedTokens(nfts.map((nft) => nft?.token_id.toString() || ""));
    }
  };

  const renderNftDetails = (nft: MergedNftData) => {
    const metadata = nft?.metadata;
    
    // Check if it's a Season Pass by looking for resources
    const hasResources = metadata?.attributes?.some((attr: any) => attr.trait_type === "Resource");
    
    if (hasResources) {
      // Season Pass specific rendering
      return (
        <>
          <TableCell>{metadata?.name}</TableCell>
          <TableCell className="flex flex-wrap gap-2">
            {metadata?.attributes
              ?.filter((attribute: any) => attribute.trait_type === "Resource")
              .map((attribute: any, index: number) => (
                <ResourceIcon
                  resource={attribute.value as string}
                  size="lg"
                  key={`${attribute.trait_type}-${index}`}
                />
              ))}
          </TableCell>
        </>
      );
    } else {
      // Generic NFT rendering
      return (
        <>
          <TableCell>{metadata?.name || `${collectionName} #${nft.token_id}`}</TableCell>
          <TableCell>
            {metadata?.image && (
              <img 
                src={metadata.image.startsWith("ipfs://") 
                  ? metadata.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
                  : metadata.image
                } 
                alt={metadata?.name || `Token #${nft.token_id}`}
                className="w-16 h-16 object-cover rounded"
              />
            )}
          </TableCell>
        </>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="flex flex-col h-[80vh] text-gold">
        <div className="flex justify-between mt-4">
          <TypeH3>Transfer {collectionName}</TypeH3>

          <Button variant="secondary" onClick={toggleAllTokens} className="text-gold" size={"sm"}>
            {selectedTokens.length === nfts.length ? "Deselect All" : "Select All"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow className="uppercase">
                <TableHead>Token ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>{nfts[0]?.metadata?.attributes?.some((attr: any) => attr.trait_type === "Resource") ? "Resources" : "Preview"}</TableHead>
                <TableHead>Select</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nfts?.map((nft) => {
                const tokenId = nft?.token_id.toString();

                return (
                  <TableRow key={tokenId}>
                    <TableCell>{Number(tokenId)}</TableCell>
                    {renderNftDetails(nft)}
                    <TableCell>
                      <Checkbox
                        checked={selectedTokens.includes(tokenId || "")}
                        onCheckedChange={() => tokenId && toggleTokenSelection(tokenId)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="bottom-0 pt-4 mt-auto flex flex-col">
          <div className="mb-4 space-y-2">
            {cartridgeLoading && (
              <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 p-2 text-base text-gray-800">
                <span>Loading address...</span>
              </div>
            )}
            {cartridgeAddress && debouncedInput && (
              <div className="border p-2 rounded-md border-green-300 bg-green-50 text-base text-green/90 flex items-center justify-between gap-2">
                <span>Controller address found! {displayAddress(cartridgeAddress)}</span>

                <span>Name: {name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green/90 hover:bg-green-100"
                  onClick={() => {
                    if (cartridgeAddress) {
                      navigator.clipboard.writeText(cartridgeAddress);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 1500); // Reset after 1.5 seconds
                    }
                  }}
                >
                  {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
            {!transferTo && !cartridgeLoading && !debouncedInput && (
              <div className="text-gold text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Please enter a valid Controller ID or address
              </div>
            )}
            {selectedTokens.length === 0 && (
              <div className="text-gold text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Please select at least one {collectionName} to transfer.
              </div>
            )}
          </div>

          <div className="flex gap-4 text-xl">
            <Input
              placeholder="Enter Controller ID or address for transfer"
              value={input}
              className="text-gold text-xl p-4"
              onChange={(e) => setInput(e.target.value.toLowerCase())}
            />
            <Button variant="cta" onClick={handleTransfer} disabled={!transferTo || selectedTokens.length === 0}>
              Transfer {selectedTokens.length > 0 ? `(${selectedTokens.length})` : ""}
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-md border border-red-400 bg-red-100 p-3 text-sm shadow-sm text-red/80">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-md ">
              Transferring to a wrong address will result in loss of assets. Double-check the address.
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}