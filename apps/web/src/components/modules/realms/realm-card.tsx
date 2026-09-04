import type { RealmInventoryToken } from "@/lib/realms/get-realm-inventory";
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

const GridDetails = ({ token, tokenId }: { token: RealmMetadata | null; tokenId: number; address?: string }) => (
  <div className="flex h-full w-full flex-col justify-between">
    <div className="pb-2">
      <span className="truncate">{token?.name ?? `Realm #${tokenId}`}</span>
    </div>
    <div className="h-[48px]">
      <RealmResources traits={token?.attributes ?? []} />
    </div>
  </div>
);

export const RealmCard = ({ token, isGrid }: { token: RealmInventoryToken; isGrid?: boolean }) => {
  const { metadata, metadata_status: metadataStatus } = token;
  const parsedMetadata = metadata ? (JSON.parse(metadata) as RealmMetadata) : null;
  const { name, image } = parsedMetadata ?? {};

  return (
    <Card className="relative overflow-hidden">
      <div className="relative">
        {image || metadataStatus === "unavailable" ? (
          <Media src={image} alt={name ?? ""} mediaKey={""} unavailable={metadataStatus === "unavailable"} />
        ) : (
          <div className="w-full max-w-sm">
            <AnimatedMap />
          </div>
        )}
        {isGrid && (
          <span className="bg-foreground text-background absolute right-1 bottom-1 px-1 py-1 text-xs">
            #{Number(token.token_id)}
          </span>
        )}
      </div>
      <CardContent className="p-4">
        <GridDetails token={parsedMetadata} tokenId={token.token_id} />
      </CardContent>
    </Card>
  );
};
