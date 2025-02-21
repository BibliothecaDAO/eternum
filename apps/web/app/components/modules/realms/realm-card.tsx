import type { CollectionToken, PortfolioToken } from "@/types/ark";
import { AnimatedMap } from "@/components/icons/AnimatedMap";
import { Card, CardContent } from "@/components/ui/card";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";

import { CollectionAddresses } from "@realms-world/constants";

import Media from "./media";
import RealmResources from "./realm-resources";

export const RealmCard = ({
  token,
  isGrid,
}: {
  token: PortfolioToken;
  isGrid?: boolean;
}) => {
  return (
    <Card className="relative overflow-hidden">
      <div className="relative">
        {token.metadata?.image ? (
          <Media
            src={token.metadata.image}
            alt={token.metadata.name}
            mediaKey={token.metadata.image_key}
            /*className={isGrid ? "mx-auto" : ""}
  width={imageSize}
  height={imageSize}*/
          />
        ) : (
          <div className="w-96">
            <AnimatedMap />
          </div>
        )}
        {isGrid && (
          <span className="absolute bottom-1 right-1 bg-black px-1 py-1 text-xs">
            #{token.token_id}
          </span>
        )}
      </div>
      <CardContent className="p-4">
        <GridDetails token={token} />
      </CardContent>
    </Card>
  );
};

const GridDetails = ({
  token,
}: {
  token: CollectionToken | PortfolioToken;
  address?: string;
}) => (
  <div className="flex h-full w-full flex-col justify-between">
    <div className="flex justify-between pb-2">
      <span className="truncate">{token.metadata?.name ?? ""}</span>
      <div className="flex justify-between font-sans">
        {/*<Price token={token} />*/}
        {/*token.last_price && (
          <span className="flex text-bright-yellow/50">
            {token.last_price}
            <LordsIcon className="ml-2 h-4 w-4 self-center fill-current" />
          </span>
        )*/}
      </div>
    </div>
    <div className="h-[48px]">
      {token.metadata?.attributes &&
        [CollectionAddresses.realms[SUPPORTED_L2_CHAIN_ID]].includes(
          token.collection_address as `0x${string}`,
        ) && <RealmResources traits={token.metadata.attributes} />}
    </div>
  </div>
);
