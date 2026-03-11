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

const GridDetails = ({
  token,
}: {
  token: RealmMetadata | null;
  address?: string;
}) => (
  <div className="flex h-full w-full flex-col justify-between">
    <div className="pb-2">
      <span className="truncate">{token?.name}</span>
    </div>
    <div className="h-[48px]">
      <RealmResources traits={token?.attributes ?? []} />
    </div>
  </div>
);

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
          />
        ) : (
          <div className="w-full max-w-sm">
            <AnimatedMap />
          </div>
        )}
        {isGrid && (
          <span className="absolute bottom-1 right-1 bg-foreground text-background px-1 py-1 text-xs">
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
