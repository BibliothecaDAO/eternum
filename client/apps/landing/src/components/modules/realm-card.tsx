import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { seasonPassAddress } from "@/config";
import { GetAccountTokensQuery } from "@/hooks/gql/graphql";
import { RealmMetadata } from "@/types";
import { useReadContract } from "@starknet-react/core";
import { CheckCircle2, Loader } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResourceIcon } from "../ui/elements/resource-icon";

// Placeholder for loading state - could be a simple spinner or a blurred low-res image
const IMAGE_PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="; // Transparent 1x1 gif

interface RealmCardProps {
  realm: NonNullable<NonNullable<NonNullable<GetAccountTokensQuery>["tokenBalances"]>["edges"]>[0] & {
    seasonPassMinted?: boolean;
  };
  toggleNftSelection?: (tokenId: string, collectionAddress: string) => void;
  isSelected?: boolean;
  metadata?: RealmMetadata;
  onSeasonPassStatusChange?: (tokenId: string, hasMinted: boolean) => void;
}

export const RealmCard = ({ realm, isSelected, toggleNftSelection, onSeasonPassStatusChange }: RealmCardProps) => {
  const { tokenId, contractAddress, metadata } =
    realm.node?.tokenMetadata.__typename === "ERC721__Token"
      ? realm.node.tokenMetadata
      : { tokenId: "", contractAddress: "", metadata: "" };

  const parsedMetadata: RealmMetadata | null = metadata ? JSON.parse(metadata) : null;
  const { attributes, name, image: originalImageUrl } = parsedMetadata ?? {};

  const [isError, setIsError] = useState(true);
  const { data, error, isSuccess, refetch, isFetching } = useReadContract({
    abi: [
      {
        type: "function",
        name: "owner_of",
        inputs: [{ name: "token_id", type: "core::integer::u256" }],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
    ] as const,
    functionName: "owner_of",
    address: seasonPassAddress as `0x${string}`,
    args: [tokenId],
    watch: isError ? true : false,
  });

  // --- Image Loading State & Logic ---
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageSrc, setImageSrc] = useState<string>(IMAGE_PLACEHOLDER); // Start with placeholder
  const [imageLoadAttempts, setImageLoadAttempts] = useState(0);
  const MAX_IMAGE_LOAD_ATTEMPTS = 1; // Retry once

  const handleImageError = useCallback(() => {
    if (imageLoadAttempts < MAX_IMAGE_LOAD_ATTEMPTS) {
      setImageLoadAttempts(prev => prev + 1);
      // Simple retry: Set the src again. Browser might retry automatically,
      // but explicitly setting it ensures our logic runs.
      // Could add cache-busting query param if needed: `${originalImageUrl}?retry=${imageLoadAttempts + 1}`
      setImageSrc(originalImageUrl ?? IMAGE_PLACEHOLDER);
    } else {
        // Optional: Set a broken image placeholder if all retries fail
        // setImageSrc(BROKEN_IMAGE_PLACEHOLDER);
        console.error(`Failed to load image after ${MAX_IMAGE_LOAD_ATTEMPTS} retries: ${originalImageUrl}`);
    }
  }, [originalImageUrl, imageLoadAttempts]);

  useEffect(() => {
    // Intersection Observer setup
    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the card is intersecting (visible) and the image hasn't been loaded yet
        if (entry.isIntersecting && imageSrc === IMAGE_PLACEHOLDER && originalImageUrl) {
          setImageSrc(originalImageUrl); // Start loading the actual image
          observer.unobserve(entry.target); // Stop observing once triggered
        }
      },
      {
        rootMargin: '0px', // No margin
        threshold: 0.1 // Trigger when 10% is visible
      }
    );

    const currentRef = cardRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      // Cleanup observer on component unmount
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [originalImageUrl, imageSrc]); // Rerun if originalImageUrl changes or imageSrc resets

  // --- End Image Loading Logic ---

  const handleCardClick = () => {
    if (toggleNftSelection && !isSuccess) {
      toggleNftSelection(tokenId.toString(), contractAddress ?? "0x");
    }
  };

  useEffect(() => {
    if (isSuccess) {
      setIsError(false);
    }
  }, [isSuccess, refetch]);

  useEffect(() => {
    if (isSuccess && onSeasonPassStatusChange && tokenId) {
      onSeasonPassStatusChange(tokenId.toString(), !!data);
    }
  }, [isSuccess, data, tokenId]);

  return (
    <Card
      ref={cardRef}
      onClick={handleCardClick}
      className={`relative transition-all duration-200 rounded-lg overflow-hidden shadow-md hover:shadow-xl 
        ${isSuccess ? "cursor-not-allowed" : "cursor-pointer hover:ring-1 hover:ring-gold"} 
        ${isSelected ? "ring-2 ring-offset-2 ring-gold scale-[1.02]" : ""} 
        ${!isSuccess && !isFetching && !isSelected 
          ? "ring-1 ring-gold shadow-lg shadow-gold/40"
          : ""
        } 
      `}
    >
      <div className={`absolute inset-0 opacity-5 
        ${isFetching ? 'bg-gray-500' : isSuccess ? 'bg-dark-green' : 'bg-enemy'} 
        pointer-events-none`}
      />
      
      {/* Status Indicator Icon (Top Right) - Remains absolutely positioned */}
      {!isSelected && ( 
        <div 
          className={`absolute top-2 right-2 z-20 p-1 rounded-full bg-card/80 backdrop-blur-sm`} 
          title={isFetching ? "Checking Status..." : isSuccess ? "Season Pass Minted" : "Season Pass Not Minted"}
        >
          {isFetching ? (
            <Loader className="w-5 h-5 text-gray-400 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="w-5 h-5 text-lime-500" /> 
          ) :""}
        </div>
      )}

      {/* Prompt to Mint Section (Top of Card) */}
      {!isSuccess && !isSelected && !isFetching && (
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 text-xs font-semibold p-2 text-center border-b border-blue-200/50">
            Click card to select
          </div>
      )}

      {/* Main card content starts below the mint prompt */}
      <div className="relative z-10 bg-card/95">
        <div className="relative">
          <img
            src={imageSrc}
            alt={name ?? 'Realm Image'}
            className={`w-full object-cover h-40 sm:h-48 transition-all duration-200
              ${isSuccess
                ? 'opacity-50 filter grayscale brightness-75'
                : 'opacity-90 hover:opacity-100'
              }
              ${imageSrc === IMAGE_PLACEHOLDER ? 'animate-pulse bg-gray-200' : ''}
            `}
            onError={handleImageError}
            loading="lazy"
          />
          {isSelected && (
            <div className="absolute top-2 right-2 bg-gold text-background px-2 py-0.5 rounded-md text-xs font-bold z-20">
              Selected
            </div>
          )}
        </div>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="items-center gap-2">
            <div className="uppercase text-xs tracking-wider mb-1 flex justify-between items-center text-gray-400">
              Realm
            </div>
            <div className="flex justify-between gap-2">
              <div className="text-xl font-bold">{name}</div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="flex flex-wrap gap-2 mb-2">
            {attributes
              ?.filter((attribute) => attribute.trait_type === "Resource")
              .map((attribute, index) => (
                <ResourceIcon resource={attribute.value as string} size="sm" key={`${attribute.trait_type}-${index}`} />
              ))}
          </div>
        </CardContent>
        {attributes?.find((attribute) => attribute.trait_type === "Wonder")?.value && (
          <CardFooter className="border-t items-center bg-card/50 flex uppercase flex-wrap w-full h-full justify-center text-center p-3 text-sm">
            <span className="text-gold font-bold tracking-wide">
              {attributes.find((attribute) => attribute.trait_type === "Wonder")?.value}
            </span>
          </CardFooter>
        )}
      </div> 
    </Card>
  );
};

