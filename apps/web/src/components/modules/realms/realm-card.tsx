import type { RawTokenBalanceWithMetadata } from "@/lib/eternum/getPortfolioCollections";
import { AnimatedMap } from "@/components/icons/AnimatedMap";
import { Card, CardContent } from "@/components/ui/card";

import Media from "./media";
import RealmResources from "./realm-resources";

export interface RealmMetadata {
  name: string;
  description: string;
  image: string;
  attributes: {
    trait_type: string;
    value: string | number | undefined;
  }[];
}

export const RealmCard = ({
  token,
  isGrid,
}: {
  token: RawTokenBalanceWithMetadata;
  isGrid?: boolean;
}) => {
  const { metadata } = token;
  const parsedMetadata = metadata
    ? (JSON.parse(metadata) as RealmMetadata)
    : null;
  const { name, image } = parsedMetadata ?? {};

  return (
    <Card className="relative overflow-hidden">
      <div className="relative">
        {image ? (
          <Media
            src={image}
            alt={name ?? ""}
            mediaKey={""}
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
            #{Number(token.token_id)}
          </span>
        )}
      </div>
      <CardContent className="p-4">
        <GridDetails token={parsedMetadata} />
      </CardContent>
    </Card>
  );
};

const GridDetails = ({
  token,
}: {
  token: RealmMetadata | null;
  address?: string;
}) => (
  <div className="flex h-full w-full flex-col justify-between">
    <div className="flex justify-between pb-2">
      <span className="truncate">{token?.name}</span>
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
      <RealmResources traits={token?.attributes ?? []} />
    </div>
  </div>
);
