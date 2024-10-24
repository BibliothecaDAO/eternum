import { GetRealmsQuery } from "@/hooks/gql";
import { AnimatedGrid } from "./animated-grid";
import { RealmCard } from "./realm-card";
interface SeasonPassRowProps {
  realms: GetRealmsQuery["ercBalance"];
}

export const RealmsGrid = ({ realms }: SeasonPassRowProps) => {
  return (
    <>{realms?.length &&
    <AnimatedGrid
      items={realms}
      renderItem={(realm, index) => <RealmCard key={`${realm.title}-${index}`} {...realm} />}
    />}</>
  );
};
