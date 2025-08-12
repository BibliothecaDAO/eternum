import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getCollectionByAddress } from "@/config";
import { useMarketplace } from "@/hooks/use-marketplace";
import { trimAddress } from "@/lib/utils";
import { MergedNftData } from "@/types";
import { RESOURCE_RARITY, ResourcesIds } from "@bibliothecadao/types";
import { useAccount } from "@starknet-react/core";
import { ArrowRightLeft, Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { ChestOpeningModal } from "./chest-opening-modal";
import { TokenDetailModal } from "./token-detail-modal";

interface TokenCardProps {
  token: MergedNftData;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  toggleNftSelection?: () => void;
  totalOwnedChests?: number;
}

export const TokenCard = ({
  token,
  isSelected = false,
  onToggleSelection,
  toggleNftSelection,
  totalOwnedChests = 0,
}: TokenCardProps) => {
  const { token_id, metadata, contract_address } = token;
  const { address: accountAddress } = useAccount();
  const marketplaceActions = useMarketplace();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChestModalOpen, setIsChestModalOpen] = useState(false);
  const [remainingChests, setRemainingChests] = useState(totalOwnedChests);

  const isOwner = token.account_address === trimAddress(accountAddress);
  const collection = getCollectionByAddress(contract_address);
  const collectionName = collection?.name;
  const isLootChest = collection?.name === "Loot Chest";

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };
  const handleTransferClick = () => {
    if (toggleNftSelection) {
      toggleNftSelection();
    }
  };

  const { attributes, name, image: originalImage } = metadata ?? {};

  // Transform IPFS URLs to use Pinata gateway
  const image = originalImage?.startsWith("ipfs://")
    ? originalImage.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
    : originalImage;

  const listingActive = useMemo(() => {
    if (token.expiration !== null && token.best_price_hex !== null) {
      return true;
    }
    return false;
  }, [token.expiration, token.best_price_hex]);

  return (
    <>
      <Card
        onClick={onToggleSelection}
        className={`relative transition-all duration-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl 
          ${isSelected ? "ring-1  ring-gold scale-[1.01] bg-gold/5" : "hover:ring-1 hover:ring-gold hover:bg-gold/5"} 
          cursor-pointer group`}
      >
        <div className="relative">
          {attributes?.find((attribute) => attribute.trait_type === "Wonder")?.value && (
            <div className="absolute z-10 top-0 border-t items-center flex uppercase flex-wrap w-full py-2 justify-center text-center text-sm bg-crimson/50 rounded-t-lg">
              <span className="text-gold font-bold tracking-wide truncate">
                {attributes.find((attribute) => attribute.trait_type === "Wonder")?.value}
                <br />
                (+20% production)
              </span>
            </div>
          )}
          <img
            src={image}
            alt={name ?? "Token Image"}
            className={`w-full object-contain transition-all duration-200
              ${isSelected ? "opacity-100" : "opacity-90 group-hover:opacity-100"}`}
          />

          {/* Selection Overlay */}
          <div
            className={`absolute inset-0 bg-black/50 flex items-start justify-end transition-opacity duration-200
            ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            <div className="bg-gold text-background rounded-full font-bold m-2">
              {isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
          </div>

          {/* Listing Indicator */}
          {listingActive && (
            <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-0.5 rounded-md text-xs font-bold z-20">
              Listed
            </div>
          )}
        </div>

        <CardHeader className={`p-4 pb-2 ${isSelected ? "bg-gold/5" : ""}`}>
          <CardTitle className="items-center gap-2">
            <div className="uppercase tracking-wider mb-1 flex justify-between items-center text-muted-foreground text-xs">
              {collectionName}
            </div>
            <div className="flex justify-between gap-2">
              <h4 className="text-xl truncate">{name || `#${token_id}`}</h4>
            </div>

            <div className="flex flex-wrap gap-2">
              {attributes
                ?.filter((attribute) => attribute.trait_type === "Resource")
                .sort((a, b) => {
                  const aWithoutSpace = a.value.toString().replace(/\s/g, "");
                  const bWithoutSpace = b.value.toString().replace(/\s/g, "");
                  const idA = ResourcesIds[aWithoutSpace as keyof typeof ResourcesIds];
                  const idB = ResourcesIds[bWithoutSpace as keyof typeof ResourcesIds];
                  const rarityA = (idA !== undefined ? RESOURCE_RARITY[idA] : undefined) || Infinity;
                  const rarityB = (idB !== undefined ? RESOURCE_RARITY[idB] : undefined) || Infinity;
                  return rarityA - rarityB;
                })
                .map((attribute, index) => (
                  <ResourceIcon
                    resource={attribute.value as string}
                    size="sm"
                    key={`${attribute.trait_type}-${index}`}
                  />
                ))}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className={`px-4 pt-2 ${isSelected ? "bg-gold/5" : ""}`}>
          <div className="flex justify-between">
            <div className="flex flex-col">
              {listingActive ? (
                <div className="text-xl flex items-center gap-2 font-mono">
                  {Number(formatUnits(BigInt(token.best_price_hex ?? 0), 18)).toLocaleString()}{" "}
                  <ResourceIcon withTooltip={false} resource="Lords" size="sm" />
                </div>
              ) : (
                <div className="text-xl text-muted-foreground">Not Listed</div>
              )}

              {/*listingActive && (
                <div className="text-sm text-muted-foreground mt-1">
                  {timeRemaining ? (
                    <span className="text-red-500 font-medium">{timeRemaining}</span>
                  ) : (
                    `Expires ${new Date(Number(pass.expiration) * 1000).toLocaleString()}`
                  )}
                </div>
              )}*/}
            </div>
          </div>
        </CardContent>

        <CardFooter
          className={`border-t items-center bg-card/50 flex flex-col uppercase w-full h-full justify-between text-center p-3 text-sm gap-2
          ${isSelected ? "bg-gold/5" : ""}`}
        >
          <div className="flex w-full gap-4">
            {isOwner && isLootChest ? (
              <>
                <Button disabled={isSelected} variant="outline" className="w-full" onClick={handleCardClick}>
                  Manage
                </Button>
              </>
            ) : (
              <Button
                disabled={isSelected}
                variant={isOwner ? "outline" : "default"}
                className="w-full"
                onClick={handleCardClick}
              >
                {isOwner ? "Manage" : isSelected ? "Selected" : "Buy Now"}
              </Button>
            )}

            {isOwner && (
              <Button variant="default" size="icon" onClick={handleTransferClick} title="Transfer Pass">
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {collection?.id && (
        <TokenDetailModal
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          isLootChest={isLootChest}
          onChestOpen={() => {
            setIsChestModalOpen(true);
            setTimeout(() => {
              // This is a hack to prevent the modal from closing immediately
              setIsModalOpen(false);
            }, 100);
          }}
          tokenData={token}
          isOwner={isOwner}
          marketplaceActions={marketplaceActions}
          price={token.best_price_hex ? BigInt(token.best_price_hex) : undefined}
          orderId={token.order_id?.toString() ?? undefined}
          isListed={token.expiration !== null}
          expiration={token.expiration ? Number(token.expiration) : undefined}
        />
      )}

      {isOwner && isLootChest && (
        <ChestOpeningModal
          isOpen={isChestModalOpen}
          onOpenChange={setIsChestModalOpen}
          remainingChests={remainingChests - 1}
          onChestOpened={() => setRemainingChests((prev) => Math.max(0, prev - 1))}
        />
      )}
    </>
  );
};
