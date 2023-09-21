import React, { useEffect, useMemo, useState } from "react";
import { useDojo } from "../../DojoContext";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@latticexyz/recs";
import { unpackResources } from "../../utils/packedData";
import { FiltersPanel } from "../../elements/FiltersPanel";
import { FilterButton } from "../../elements/FilterButton";
import { RealmListItem } from "./RealmListItem";

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

  const realmEntityIds = onlyMyRealms
    ? useEntityQuery([Has(Realm), HasValue(Owner, { address: parseInt(account.address) })])
    : useEntityQuery([Has(Realm)]);

  const realmsList: any[] = useMemo(
    () =>
      Array.from(realmEntityIds).map((entityId) => {
        const realm = getComponentValue(Realm, entityId) as any;
        realm.owner = getComponentValue(Owner, entityId);
        realm.resources = unpackResources(BigInt(realm.resource_types_packed), realm.resource_types_count);
        return realm;
      }),
    [realmEntityIds],
  );

  return (
    <>
      <FiltersPanel className="px-3 py-2">
        <FilterButton active={false}>Filter</FilterButton>
      </FiltersPanel>
      <div className="flex flex-col space-y-2 px-2">
        {realmsList.map((realm) => (
          <RealmListItem key={realm.realm_id} realm={realm} />
        ))}
      </div>
    </>
  );
};
