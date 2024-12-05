import { GetRealmsQuery } from "@/hooks/gql/graphql";
import { AnimatedGrid } from "./animated-grid";
import { RealmCard } from "./realm-card";

interface RealmGridItem {
  colSpan?: {
    sm?: number;
    md?: number;
    lg?: number;
  };
  data: NonNullable<NonNullable<GetRealmsQuery["tokenBalances"]>["edges"]>[number];
}

interface SeasonPassRowProps {
  realms?: NonNullable<GetRealmsQuery["tokenBalances"]>["edges"];
  seasonPassTokenIds?: string[];
  toggleNftSelection: (tokenId: string, collectionAddress: string) => void;
  isNftSelected?: (tokenId: string, contractAddress: string) => boolean;
  onSeasonPassStatusChange?: (tokenId: string, hasMinted: boolean) => void;
}

export const RealmsGrid = ({ realms, toggleNftSelection, isNftSelected, onSeasonPassStatusChange }: SeasonPassRowProps) => {
  if (!realms?.length) return <div>No Realms found</div>;

  const gridItems: RealmGridItem[] = realms.map((realm) => ({
    colSpan: { sm: 6, md: 4, lg: 3 },
    data: realm!,
  }));

  return (
    <AnimatedGrid
      items={gridItems}
      renderItem={(item) => {
        const realm = item.data;
        if (!realm?.node) return null;

        const isSelected =
          isNftSelected?.(realm.node.tokenMetadata.tokenId, realm.node.tokenMetadata.contractAddress) ?? false;

        return (
          <RealmCard
            toggleNftSelection={toggleNftSelection}
            key={`${realm.node.tokenMetadata.tokenId}`}
            isSelected={isSelected}
            realm={realm}
            onSeasonPassStatusChange={onSeasonPassStatusChange}
          />
        );
      }}
    />
  );
};
