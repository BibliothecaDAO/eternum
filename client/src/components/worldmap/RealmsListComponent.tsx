import React, { useEffect, useMemo, useState } from "react";
import { useDojo } from "../../DojoContext";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@latticexyz/recs";
import { unpackResources } from "../../utils/packedData";
import { FiltersPanel } from "../../elements/FiltersPanel";
import { FilterButton } from "../../elements/FilterButton";
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
      <FiltersPanel className="px-3 py-2">
        <FilterButton active={false}>Filter</FilterButton>
      </FiltersPanel>
      <div className="flex flex-col space-y-2 px-2 mb-2">
        {realmsList.map((realm) => (
          <RealmListItem key={realm.realmId} realm={realm} />
        ))}
      </div>
    </>
  );
};
