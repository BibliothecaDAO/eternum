import { useMemo } from "react";
import { useDojo } from "../../DojoContext";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue } from "@latticexyz/recs";
import { RealmListItem } from "./RealmListItem";
import { useGetRealms } from "../../hooks/helpers/useRealm";

type RealmsListComponentProps = {
  onlyMyRealms?: boolean;
};

export const RealmsListComponent = ({ onlyMyRealms = false }: RealmsListComponentProps) => {
  const {
    account: { account },
    setup: {
      components: { Realm, Owner },
    },
  } = useDojo();

  const { realms } = useGetRealms();

  const myRealms = onlyMyRealms ? useEntityQuery([Has(Realm), HasValue(Owner, { address: account.address })]) : [];

  const realmsList = useMemo(() => {
    if (onlyMyRealms) {
      return realms.filter((realm) => myRealms.includes(realm.entity_id));
    } else {
      return realms;
    }
  }, [realms, myRealms]);

  return (
    <>
      <div className="flex flex-col space-y-2 px-2 my-2">
        {realmsList.map((realm) => {
          return <RealmListItem key={realm.entity_id} realm={realm} />;
        })}
      </div>
    </>
  );
};
