import { AnimatedGrid } from "./animated-grid";
import { Realm, RealmCard } from "./realm-card";

interface SeasonPassRowProps {
  realms: Realm[];
}

export const RealmsGrid = ({ realms }: SeasonPassRowProps) => {
  return (
    <AnimatedGrid
      items={realms}
      renderItem={(realm, index) => <RealmCard key={`${realm.title}-${index}`} {...realm} />}
    />
  );
};
