import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccount, useContract, useSendTransaction } from "@starknet-react/core";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { getChecksumAddress, validateChecksumAddress } from "starknet";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent } from "../ui/dialog";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { Input } from "../ui/input";

import { abi } from "@/abi/SeasonPass";
import { seasonPassAddress } from "@/config";
import { useCartridgeAddress } from "@/hooks/use-cartridge-address";
import useDebounce from "@/hooks/use-debounce";
import { displayAddress } from "@/lib/utils";
import { RealmMetadata, SeasonPassMint } from "@/types";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { TypeH3 } from "../typography/type-h3";

interface TransferSeasonPassProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  seasonPassMints: SeasonPassMint[];
}

export default function TransferSeasonPassDialog({ isOpen, setIsOpen, seasonPassMints }: TransferSeasonPassProps) {
  const [input, setInput] = useState<string>("");
  const debouncedInput = useDebounce(input, 500); // 500ms delay

  const [transferTo, setTransferTo] = useState<string | null>(null);
  const [selectedRealms, setSelectedRealms] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  const toggleRealmSelection = (tokenId: string) => {
    setSelectedRealms((prev) => {
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
    address: seasonPassAddress as `0x${string}`,
  });

  const { address: cartridgeAddress, fetchAddress, loading: cartridgeLoading } = useCartridgeAddress();

  const { sendAsync, error } = useSendTransaction({
    calls:
      contract && address && transferTo
        ? selectedRealms.map((tokenId) =>
            contract.populate("transfer_from", [address, BigInt(transferTo || ""), tokenId]),
          )
        : undefined,
  });

  const handleTransfer = async () => {
    if (!transferTo || selectedRealms.length === 0) return;
    setIsOpen(false);
    const tx = await sendAsync();
    console.log(tx);
    if (tx) {
      setInput("");
      setSelectedRealms([]);
      setTransferTo(null);
    }
  };

  useEffect(() => {
    const validateAndSetTransferAddress = async () => {
      if (!debouncedInput) {
        setTransferTo(null);
        return;
      }

      if (debouncedInput.startsWith("0x")) {
        try {
          if (validateChecksumAddress(getChecksumAddress(debouncedInput))) {
            setTransferTo(debouncedInput);
            return;
          }
        } catch (error) {
          console.error("Error validating address:", error);
        }
      } else {
        await fetchAddress(debouncedInput);
      }

      if (cartridgeAddress) {
        setTransferTo(cartridgeAddress);
        return;
      }

      setTransferTo(null);
    };

    validateAndSetTransferAddress();
  }, [debouncedInput, cartridgeAddress, fetchAddress]);

  const toggleAllRealms = () => {
    if (selectedRealms.length === seasonPassMints.length) {
      // If all realms are selected, deselect all
      setSelectedRealms([]);
    } else {
      // Select all realms
      setSelectedRealms(seasonPassMints.map((mint) => mint?.node?.tokenMetadata?.tokenId || ""));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="flex flex-col h-[80vh] text-gold">
        <div className="flex justify-between mt-4">
          <TypeH3>Transfer Season Pass </TypeH3>

          <Button variant="secondary" onClick={toggleAllRealms} className="text-gold" size={"sm"}>
            {selectedRealms.length === seasonPassMints.length ? "Deselect All" : "Select All"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow className="uppercase">
                <TableHead>Token ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Select</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasonPassMints?.map((seasonPassMint) => {
                const parsedMetadata: RealmMetadata | null = seasonPassMint?.node.tokenMetadata.metadata
                  ? JSON.parse(seasonPassMint?.node.tokenMetadata.metadata)
                  : null;
                const { attributes, name } = parsedMetadata ?? {};
                const tokenId = seasonPassMint?.node.tokenMetadata.tokenId;

                return (
                  <TableRow key={tokenId}>
                    <TableCell>{Number(tokenId)}</TableCell>
                    <TableCell>{name}</TableCell>
                    <TableCell className="flex flex-wrap gap-2">
                      {attributes
                        ?.filter((attribute) => attribute.trait_type === "Resource")
                        .map((attribute, index) => (
                          <ResourceIcon
                            resource={attribute.value as string}
                            size="lg"
                            key={`${attribute.trait_type}-${index}`}
                          />
                        ))}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={selectedRealms.includes(tokenId || "")}
                        onCheckedChange={() => tokenId && toggleRealmSelection(tokenId)}
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
                 <span>Controller Address Found! {displayAddress(cartridgeAddress)}</span>
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
            {!cartridgeLoading && !cartridgeAddress && debouncedInput && (
              <div className="flex items-center gap-2 rounded-md border border-green-400 bg-green-100 p-2 text-base text-red/90">
                <span>No controller address found for "{debouncedInput}".</span>
              </div>
            )}
            {!transferTo && !cartridgeLoading && !debouncedInput && (
                <div className="text-gold text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Please enter a valid Controller ID or address
                </div>
            )}
          </div>

          <div className="flex gap-4 text-xl">
            <Input
              placeholder="Enter Controller ID or address for transfer"
              value={input}
              className="text-gold text-2xl p-4"
              onChange={(e) => setInput(e.target.value.toLowerCase())}
            />
            <Button variant="cta" onClick={handleTransfer} disabled={!transferTo || selectedRealms.length === 0}>
              Transfer {selectedRealms.length > 0 ? `(${selectedRealms.length})` : ""}
            </Button>
          </div>
          
          <div className="mt-4 flex items-center gap-2 rounded-md border border-red-400 bg-red-100 p-3 text-sm shadow-sm text-red/80">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-md ">Transferring to a wrong address will result in loss of assets. 
  Double-check the address.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
