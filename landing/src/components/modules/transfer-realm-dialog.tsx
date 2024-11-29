import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccount, useContract, useNetwork, useSendTransaction } from "@starknet-react/core";
import { useEffect, useState } from "react";
import { validateChecksumAddress } from "starknet";
import { TypeH2 } from "../typography/type-h2";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent } from "../ui/dialog";
import { ResourceIcon } from "../ui/elements/ResourceIcon";
import { Input } from "../ui/input";
import { RealmMetadata } from "./realms-grid";

import { abi } from "@/abi/SeasonPass";
import { useDojo } from "@/hooks/context/DojoContext";
import { useCartridgeAddress } from "@/hooks/use-cartridge-address";
import { AlertCircle } from "lucide-react";

export type SeasonPassMint = {
  __typename?: "Token__Transfer";
  tokenMetadata: {
    __typename: "ERC721__Token";
    tokenId: string;
    metadataDescription: string;
    imagePath: string;
    contractAddress: string;
    metadata: string;
  };
} | null;

interface TransferRealmDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  seasonPassMints: SeasonPassMint[];
}

export default function TransferRealmDialog({ isOpen, setIsOpen, seasonPassMints }: TransferRealmDialogProps) {
  const [input, setInput] = useState<string>("");

  const [transferTo, setTransferTo] = useState<string | null>(null);
  const [selectedRealms, setSelectedRealms] = useState<string[]>([]);

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
  const { chain } = useNetwork();
  const { contract } = useContract({
    abi,
    address: chain.nativeCurrency.address,
  });

  const { account } = useDojo();

  const { address: cartridgeAddress, fetchAddress, loading: cartridgeLoading } = useCartridgeAddress();

  const { send, error } = useSendTransaction({
    calls:
      contract && address && transferTo
        ? selectedRealms.map((tokenId) =>
            contract.populate("transfer_from", [account.account?.address, BigInt(transferTo || ""), tokenId]),
          )
        : undefined,
  });

  const handleTransfer = () => {
    if (!transferTo || selectedRealms.length === 0) return;

    send();
  };

  useEffect(() => {
    const validateAndSetTransferAddress = async () => {
      if (!input) {
        setTransferTo(null);
        return;
      }

      try {
        if (validateChecksumAddress(input)) {
          setTransferTo(input);
          return;
        }

        await fetchAddress(input);

        if (cartridgeAddress) {
          setTransferTo(cartridgeAddress);
          return;
        }

        setTransferTo(null);
      } catch (error) {
        console.error("Error validating address:", error);
        setTransferTo(null);
      }
    };

    validateAndSetTransferAddress();
  }, [input, cartridgeAddress, fetchAddress]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="flex flex-col h-[80vh]">
        <TypeH2 className="text-gold">Transfer Season Pass</TypeH2>
        <div className="flex-1 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Token ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-gold">
              {seasonPassMints.map((seasonPassMint) => {
                const parsedMetadata: RealmMetadata | null = seasonPassMint?.tokenMetadata.metadata
                  ? JSON.parse(seasonPassMint?.tokenMetadata.metadata)
                  : null;
                const { attributes, name } = parsedMetadata ?? {};
                const tokenId = seasonPassMint?.tokenMetadata.tokenId;

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
        <div className="bottom-0 pt-4 mt-auto flex flex-col border-t bg-background gap-4">
          <div className="text-gold text-sm">Found: {cartridgeLoading ? "loading" : cartridgeAddress}</div>

          <div className="flex gap-4">
            <Input
              placeholder="Enter the Controller ID to transfer to"
              value={input}
              className="text-gold"
              onChange={(e) => setInput(e.target.value)}
            />
            <Button variant="cta" onClick={handleTransfer} disabled={!transferTo || selectedRealms.length === 0}>
              Transfer {selectedRealms.length > 0 ? `(${selectedRealms.length})` : ""}
            </Button>
          </div>
          {!transferTo && (
            <div className="text-gold text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Please enter a Controller ID
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
