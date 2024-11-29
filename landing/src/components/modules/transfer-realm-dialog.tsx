import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccount, useContract, useNetwork, useSendTransaction } from "@starknet-react/core";
import { useState } from "react";
import { TypeH2 } from "../typography/type-h2";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent } from "../ui/dialog";
import { ResourceIcon } from "../ui/elements/ResourceIcon";
import { Input } from "../ui/input";
import { RealmMetadata } from "./realms-grid";

import { abi } from "@/abi/SeasonPass";

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
  const [transferTo, setTransferTo] = useState<string>("");
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

  const { send, error } = useSendTransaction({
    calls:
      contract && address
        ? selectedRealms.map((tokenId) => contract.populate("transfer_from", [address, transferTo, tokenId]))
        : undefined,
  });

  const handleTransfer = () => {
    if (!transferTo || selectedRealms.length === 0) return;

    send();
  };

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
        <div className="bottom-0 pt-4 mt-auto flex justify-end border-t bg-background gap-4">
          <Input
            placeholder="Enter the address or StarknetID to transfer to"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
          />
          <Button variant="cta" onClick={handleTransfer} disabled={!transferTo || selectedRealms.length === 0}>
            Transfer {selectedRealms.length > 0 ? `(${selectedRealms.length})` : ""}
          </Button>
          {error && <p className="text-red-500">{error.message}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
