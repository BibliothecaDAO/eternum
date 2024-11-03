import { GetRealmsQuery } from "@/hooks/gql/graphql";
import { AnimatedGrid } from "./animated-grid";
import { RealmCard } from "./realm-card";
interface SeasonPassRowProps {
  realms?: GetRealmsQuery["ercBalance"];
  seasonPassTokenIds?: string[];
  toggleNftSelection: (tokenId: string, collectionAddress: string) => void;
  isNftSelected?: (tokenId: string, contractAddress: string) => boolean;
}

export const RealmsGrid = ({ realms, toggleNftSelection, isNftSelected, seasonPassTokenIds }: SeasonPassRowProps) => {
  return (
    <>
      {realms?.length ? (
        <AnimatedGrid
          items={realms}
          renderItem={(realm, index) => {
            const isSelected =
              isNftSelected && realm?.tokenMetadata.tokenId
                ? isNftSelected(realm?.tokenMetadata.tokenId, realm?.tokenMetadata.contractAddress)
                : false;
            return (
              <>
                {realm ? (
                  <RealmCard
                    toggleNftSelection={toggleNftSelection}
                    key={`${realm?.tokenMetadata.tokenId}-${index}`}
                    isSelected={isSelected}
                    realm={realm}
                    seasonPassMinted={seasonPassTokenIds?.includes(realm?.tokenMetadata.tokenId)}
                  />
                ) : null}
              </>
            );
          }}
        />
      ) : (
        "No Realms found"
      )}
    </>
  );
};
