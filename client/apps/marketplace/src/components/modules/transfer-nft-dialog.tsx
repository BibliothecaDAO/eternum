import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { displayAddress } from "@/lib/utils";
import { MergedNftData } from "@/types";
import { useAccount, useContract, useSendTransaction } from "@starknet-react/core";
import { AlertCircle, AlertTriangle, Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { Abi } from "starknet";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent } from "../ui/dialog";
import { Input } from "../ui/input";

interface TransferNftDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  nfts: MergedNftData[];
  initialSelectedTokenId?: string | null;
  contractAddress: string;
  contractAbi: Abi;
}

export default function TransferNftDialog({
  isOpen,
  setIsOpen,
  nfts,
  initialSelectedTokenId,
  contractAddress,
  contractAbi,
}: TransferNftDialogProps) {
  const [input, setInput] = useState<string>("");
  const [transferTo, setTransferTo] = useState<string | null>(null);
  const [selectedNfts, setSelectedNfts] = useState<string[]>(initialSelectedTokenId ? [initialSelectedTokenId] : []);
  const [isCopied, setIsCopied] = useState(false);

  const toggleNftSelection = (tokenId: string) => {
    setSelectedNfts((prev) => {
      if (prev.includes(tokenId)) {
        return prev.filter((id) => id !== tokenId);
      } else {
        return [...prev, tokenId];
      }
    });
  };

  const { address } = useAccount();
  const { contract } = useContract({
    abi: contractAbi,
    address: contractAddress as `0x${string}`,
  });

  const { sendAsync } = useSendTransaction({
    calls:
      contract && address && transferTo
        ? selectedNfts.map((tokenId) =>
            contract.populate("transfer_from", [address, BigInt(transferTo || ""), tokenId]),
          )
        : undefined,
  });

  const handleTransfer = async () => {
    if (!transferTo || selectedNfts.length === 0) return;
    setIsOpen(false);
    const tx = await sendAsync();
    console.log(tx);
    if (tx) {
      setInput("");
      setSelectedNfts([]);
      setTransferTo(null);
    }
  };

  useEffect(() => {
    const validateAndSetTransferAddress = () => {
      if (!input) {
        setTransferTo(null);
        return;
      }

      // Check if the input looks like a Starknet address (hex)
      if (input.startsWith("0x") && input.length === 66) {
        setTransferTo(input);
      } else {
        // Check if the input can be converted to a BigInt (decimal or other valid format)
        try {
          BigInt(input);
          // If conversion succeeds, set it as the transfer target
          setTransferTo(input);
        } catch {
          // If conversion fails, transferTo remains null
          setTransferTo(null);
        }
      }
    };

    validateAndSetTransferAddress();
  }, [input]);

  const toggleAllNfts = () => {
    if (selectedNfts.length === nfts.length) {
      // If all NFTs are selected, deselect all
      setSelectedNfts([]);
    } else {
      // Select all NFTs
      setSelectedNfts(nfts.map((nft) => nft?.token_id.toString() || ""));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="flex flex-col h-[80vh] text-gold">
        <div className="flex justify-between mt-4">
          <h3 className="text-xl font-bold">Transfer NFTs</h3>

          <Button variant="secondary" onClick={toggleAllNfts} className="text-gold" size={"sm"}>
            {selectedNfts.length === nfts.length ? "Deselect All" : "Select All"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow className="uppercase">
                <TableHead>Token ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Select</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nfts?.map((nft) => {
                const metadata = nft?.metadata;
                const name = metadata?.name || `Token #${nft.token_id}`;
                const tokenId = nft?.token_id.toString();

                return (
                  <TableRow key={tokenId}>
                    <TableCell>{Number(tokenId)}</TableCell>
                    <TableCell>{name}</TableCell>
                    <TableCell>{displayAddress(nft.contract_address)}</TableCell>
                    <TableCell>
                      <Checkbox
                        checked={selectedNfts.includes(tokenId || "")}
                        onCheckedChange={() => tokenId && toggleNftSelection(tokenId)}
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
            {transferTo && input && (
              <div className="border p-2 rounded-md border-green-300 bg-green-50 text-base text-green/90 flex items-center justify-between gap-2">
                <span>Transfer address: {displayAddress(transferTo)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green/90 hover:bg-green-100"
                  onClick={() => {
                    if (transferTo) {
                      navigator.clipboard.writeText(transferTo);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 1500);
                    }
                  }}
                >
                  {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
            {!transferTo && input && (
              <div className="text-red-500 text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Please enter a valid address
              </div>
            )}
            {selectedNfts.length === 0 && (
              <div className="text-gold text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Please select at least one NFT to transfer.
              </div>
            )}
          </div>

          <div className="flex gap-4 text-xl">
            <Input
              placeholder="Enter recipient address"
              value={input}
              className="text-gold text-xl p-4"
              onChange={(e) => setInput(e.target.value.toLowerCase())}
            />
            <Button variant="cta" onClick={handleTransfer} disabled={!transferTo || selectedNfts.length === 0}>
              Transfer {selectedNfts.length > 0 ? `(${selectedNfts.length})` : ""}
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
