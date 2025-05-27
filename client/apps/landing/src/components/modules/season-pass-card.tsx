import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { marketplaceCollections, seasonPassAddress } from "@/config";
import { useMarketplace } from "@/hooks/use-marketplace";
import { trimAddress } from "@/lib/utils";
import { MergedNftData } from "@/types";
import { RESOURCE_RARITY, ResourcesIds } from "@bibliothecadao/types"; // Import enums
import { useAccount } from "@starknet-react/core";
import { ArrowRightLeft, Check, Plus } from "lucide-react"; // Import the icon
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { RealmDetailModal } from "./realm-detail-modal";

interface SeasonPassCardProps {
  pass: MergedNftData;
  checkOwner?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  toggleNftSelection?: () => void;
}

interface ListingDetails {
  orderId?: bigint;
  price?: bigint | null;
  isListed: boolean;
  expiration?: string;
}

function getCollectionByAddress(address: string): (typeof marketplaceCollections)[keyof typeof marketplaceCollections] {
  const collection = Object.entries(marketplaceCollections).find(([_, data]) => {
    return trimAddress(data.address)?.toLowerCase() === trimAddress(address)?.toLowerCase();
  });
  return collection ? collection[1] : marketplaceCollections["season-passes"]; // Default to season passes if not found
}

export const SeasonPassCard = ({
  pass,
  checkOwner = false,
  isSelected = false,
  onToggleSelection,
  toggleNftSelection,
}: SeasonPassCardProps) => {
  const { token_id, metadata, contract_address } = pass;
  const { address: accountAddress } = useAccount();
  const marketplaceActions = useMarketplace({ collectionAddress: contract_address });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [listingDetails, setListingDetails] = useState<ListingDetails>({ isListed: false });
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const isOwner = pass.account_address === trimAddress(accountAddress);
  const collection = getCollectionByAddress(contract_address);
  const collectionName = collection.name;
  // Calculate time remaining for auctions about to expire
  useEffect(() => {
    if (!pass.expiration) return;

    const expirationTime = Number(pass.expiration) * 1000;
    const updateCountdown = () => {
      const now = Date.now();
      const diff = expirationTime - now;

      if (diff <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      // Only show countdown if less than an hour remains
      if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeRemaining(`${minutes}m ${seconds}s remaining`);
      } else {
        setTimeRemaining(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [pass.expiration]);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };
  const handleTransferClick = () => {
    if (toggleNftSelection) {
      toggleNftSelection();
    }
  };

  const { attributes, name, image } = metadata ?? {};

  // Prepare data for the modal (useMemo)
  const modalData = useMemo(
    () => ({
      tokenId: token_id?.toString(),
      contractAddress: seasonPassAddress,
      name: name,
      imageSrc: image || "",
      attributes: attributes,
    }),
    [token_id, seasonPassAddress, name, image, attributes],
  );

  const listingActive = useMemo(() => {
    if (pass.expiration !== null && pass.best_price_hex !== null) {
      return true;
    }
    return false;
  }, [pass.expiration, pass.best_price_hex]);

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
            alt={name ?? "Season Pass"}
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
          {listingDetails.isListed && (
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
              <h4 className="text-xl truncate">{name || `Pass #${token_id}`}</h4>
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
                  {Number(formatUnits(BigInt(pass.best_price_hex ?? 0), 18)).toLocaleString()}{" "}
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
            <Button
              disabled={isSelected}
              variant={isOwner ? "outline" : "default"}
              className="w-full"
              onClick={handleCardClick}
            >
              {isOwner ? "Manage" : isSelected ? "Selected" : "Buy Now"}
            </Button>

            {isOwner && (
              <Button variant="default" size="icon" onClick={handleTransferClick} title="Transfer Pass">
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      <RealmDetailModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        realmData={pass}
        isOwner={isOwner}
        marketplaceActions={marketplaceActions}
        collection_id={collection.id}
        price={pass.best_price_hex ? BigInt(pass.best_price_hex) : undefined}
        orderId={pass.order_id?.toString() ?? undefined}
        isListed={pass.expiration !== null}
        expiration={pass.expiration ? Number(pass.expiration) : undefined}
      />
    </>
  );
};
