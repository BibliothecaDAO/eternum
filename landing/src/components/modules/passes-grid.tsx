import { GetRealmsQuery } from "@/hooks/gql/graphql";
import { AnimatedGrid } from "./animated-grid";
import { PassCard } from "./pass-card";

export type RealmMetadata = {
  name: string;
  description: string;
  image: string;
  attributes: {
    trait_type: string;
    value: string | number;
  }[];
};

interface RealmGridItem {
  colSpan?: {
    sm?: number;
    md?: number;
    lg?: number;
  };
  data: NonNullable<NonNullable<GetRealmsQuery["tokenBalances"]>["edges"]>[number];
}

interface SeasonPassRowProps {
  seasonPasses?: NonNullable<GetRealmsQuery["tokenBalances"]>["edges"];
  toggleNftSelection?: (tokenId: string, collectionAddress: string) => void;
  isNftSelected?: (tokenId: string, contractAddress: string) => boolean;
}

export const PassesGrid = ({ toggleNftSelection, isNftSelected, seasonPasses }: SeasonPassRowProps) => {
  if (!seasonPasses?.length) return <div>No Season Pass Found</div>;

  const gridItems: RealmGridItem[] = seasonPasses.map((pass) => ({
    colSpan: { sm: 6, md: 4, lg: 3 },
    data: pass!,
  }));

  return (
    <AnimatedGrid
      items={gridItems}
      renderItem={(item) => {
        const pass = item.data;
        if (!pass?.node) return null;

        return (
          <PassCard toggleNftSelection={toggleNftSelection} key={`${pass.node.tokenMetadata.tokenId}`} pass={pass} />
        );
      }}
    />
  );
};
