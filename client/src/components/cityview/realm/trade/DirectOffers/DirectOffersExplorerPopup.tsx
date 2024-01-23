import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import { Headline } from "../../../../../elements/Headline";
import {
  RealmInterface,
  ResourcesIds,
  SPEED_PER_DONKEY,
  findResourceById,
  getOrderName,
  resources,
} from "@bibliothecadao/eternum";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import Button from "../../../../../elements/Button";
import { FilterButton } from "../../../../../elements/FilterButton";
import { SortPanel } from "../../../../../elements/SortPanel";
import {
  calculateDistance,
  currencyIntlFormat,
  formatTimeLeft,
  formatTimeLeftDaysHoursMinutes,
} from "../../../../../utils/utils";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import { OnlineStatus } from "../../../../../elements/OnlineStatus";
import { useLabor } from "../../../../../hooks/helpers/useLabor";
import { useResources } from "../../../../../hooks/helpers/useResources";
import { getRealm, getRealmOrderNameById } from "../../../../../utils/realms";
import useUIStore from "../../../../../hooks/store/useUIStore";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { FastCreateOfferPopup } from "../FastCreateOffer";
import TextInput from "../../../../../elements/TextInput";

type DirectOffersExplorerPopupProps = {
  onClose: () => void;
};

export const DirectOffersExplorerPopup = ({ onClose }: DirectOffersExplorerPopupProps) => {
  const [selectedResourceId, setSelectedResourceId] = useState<any>(null);
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [directOfferRealmId, setDirectOfferRealmId] = useState<bigint>();

  useEffect(() => {}, []);

  return (
    <>
      {showCreateOffer && (
        <FastCreateOfferPopup
          isBuy={true}
          resourceId={selectedResourceId}
          directOfferRealmId={directOfferRealmId}
          onClose={() => setShowCreateOffer(false)}
          onCreate={() => {}}
        />
      )}
      <SecondaryPopup name="direct-offers-explorer">
        <SecondaryPopup.Head onClose={onClose}>
          <div className="flex items-center space-x-1">
            <div className="mr-0.5">Marketplace</div>
          </div>
        </SecondaryPopup.Head>
        <SecondaryPopup.Body width={"660px"}>
          {selectedResourceId ? (
            <RealmResourceExplorerPanel
              resourceId={selectedResourceId}
              setSelectedResourceId={setSelectedResourceId}
              onCreateDirectOffer={(realmId) => {
                setDirectOfferRealmId(realmId);
                setShowCreateOffer(true);
              }}
            />
          ) : (
            <SelectResourcePanel setSelectedResourceId={(id: number) => setSelectedResourceId(id)} />
          )}
        </SecondaryPopup.Body>
      </SecondaryPopup>
    </>
  );
};

const SelectResourcePanel = ({ setSelectedResourceId }: { setSelectedResourceId: (id: number) => void }) => {
  return (
    <div className="flex flex-col p-2">
      <Headline>Choose resource</Headline>
      <div className="grid grid-cols-6 gap-3 my-5 mx-4">
        {resources.map((resource) => {
          if (resource.id === ResourcesIds.Lords) return;
          return (
            <div
              onClick={() => setSelectedResourceId(resource.id)}
              className="flex rounded-xl hover:text-lightest hover:bg-black relative flex-col p-2 pb-8 items-center justify-center text-center text-light-pink text-xs"
            >
              <ResourceIcon withTooltip={false} key={resource.id} resource={resource.trait} size="lg" />
              <div className="absolute bottom-5 h-4">{resource.trait}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RealmResourceExplorerPanel = ({
  resourceId,
  setSelectedResourceId,
  onCreateDirectOffer,
}: {
  resourceId: number;
  setSelectedResourceId: (resourceId: number | null) => void;
  onCreateDirectOffer: (realmId: bigint) => void;
}) => {
  const sortingParams = useMemo(() => {
    return [
      { label: "Amount", sortKey: "amount", className: "w-[250px]" },
      { label: "Realm", sortKey: "realm", className: "mr-auto" },
      { label: "Travel time", sortKey: "time", className: "ml-auto" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });
  const [nameFilter, setNameFilter] = useState("");
  const deferredNameFilter = useDeferredValue(nameFilter);

  const realmId = useRealmStore((state) => state.realmId);

  // get realms that have that resource
  const { getRealmsWithSpecificResource } = useResources();
  const realms = getRealmsWithSpecificResource(resourceId, 1000).map((realm) => {
    const realmData = getRealm(realm.realmId);
    // counterparty
    const realmPosition = realmData ? realmData.position : undefined;
    // yours
    const yourRealmPosition = realmId ? getRealm(realmId)?.position : undefined;
    const distance = realmPosition && yourRealmPosition ? calculateDistance(realmPosition, yourRealmPosition) : 0;
    return {
      ...realm,
      realm: realmData,
      distance,
    };
  });

  const realmsFilteredByName = useMemo(() => {
    return realms.filter(
      (realm) =>
        realm.realm?.name.toLowerCase().includes(deferredNameFilter.toLowerCase()) ||
        realm.realm?.realmId.toString().includes(deferredNameFilter),
    );
  }, [realms, deferredNameFilter]);

  return (
    <>
      <div className="flex flex-col p-2 overflow-hidden">
        <div className="flex items-center justify-between">
          <FiltersPanel>
            <FilterButton active={true} onClick={() => setSelectedResourceId(null)}>
              Resource: {findResourceById(resourceId)?.trait}
            </FilterButton>
          </FiltersPanel>
          <TextInput
            className="border border-gold ml-auto !w-40 !flex-grow-0 !text-light-pink text-xs"
            placeholder="Search by ID or name"
            value={nameFilter}
            onChange={setNameFilter}
          />
        </div>
        <SortPanel className="mt-2 py-2 border-b-0">
          {sortingParams.map(({ label, sortKey, className }) => (
            <SortButton
              className={className}
              key={sortKey}
              label={label}
              sortKey={sortKey}
              activeSort={activeSort}
              onChange={(_sortKey, _sort) => {
                setActiveSort({
                  sortKey: _sortKey,
                  sort: _sort,
                });
              }}
            />
          ))}
        </SortPanel>
        <div className="flex flex-col overflow-auto">
          {realmsFilteredByName
            .filter((realm) => realmId !== realm.realmId)
            .map(({ realmEntityId, amount, realm, distance }) => (
              <div className="mt-2">
                <RealmResourceRow
                  realmEntityId={realmEntityId}
                  balance={amount}
                  resourceId={resourceId}
                  realm={realm}
                  distance={distance}
                  onCreateDirectOffer={onCreateDirectOffer}
                />
              </div>
            ))}
        </div>
      </div>
    </>
  );
};

type RealmResourceRowProps = {
  realmEntityId: bigint;
  balance: number;
  resourceId: number;
  realm: RealmInterface | undefined;
  distance: number;
  onCreateDirectOffer: (realmId: bigint) => void;
};

const RealmResourceRow = ({
  realmEntityId,
  balance,
  resourceId,
  realm,
  distance,
  onCreateDirectOffer,
}: RealmResourceRowProps) => {
  const { getLatestRealmActivity } = useLabor();

  const setTooltip = useUIStore((state) => state.setTooltip);

  const latestActivity = getLatestRealmActivity(realmEntityId);

  let status: "online" | "recently" | "offline" = "offline";

  // 86400 = 1 day
  // 259200 = 3 days
  status = !latestActivity
    ? "offline"
    : latestActivity < 86400
    ? "online"
    : latestActivity < 259200
    ? "recently"
    : "offline";

  return (
    <div className="grid rounded-md hover:bg-white/10 items-center border-b h-8 border-black grid-cols-[250px,1fr,1fr] text-lightest text-xxs">
      <div className="flex items-center">
        <ResourceIcon
          containerClassName="mr-2 w-min"
          withTooltip={false}
          resource={findResourceById(resourceId)?.trait || ""}
          size="sm"
        />
        {currencyIntlFormat(balance)}
      </div>
      <div className="flex mr-auto items-center text-light-pink">
        <OnlineStatus
          onMouseEnter={() =>
            setTooltip({
              position: "top",
              content: (
                <>
                  <p className="whitespace-nowrap">
                    {latestActivity ? `${formatTimeLeftDaysHoursMinutes(latestActivity)} ago` : "No Activity"}
                  </p>
                </>
              ),
            })
          }
          onMouseLeave={() => setTooltip(null)}
          status={status}
        />
        {realm && <OrderIcon className="mr-2" size="xs" order={getOrderName(realm.order)} />}
        {realm?.name}
      </div>

      <div className="flex items-center justify-between text-lightest">
        <div className="w-[40px] text-left">{distance.toFixed(0)} km </div>
        <div className="text-light-pink inline-block ml-2">{`(${formatTimeLeft(
          (distance / SPEED_PER_DONKEY) * 3600,
        )})`}</div>
        <Button
          className="ml-2"
          onClick={() => onCreateDirectOffer(realm?.realmId || 0n)}
          disabled={false}
          size="xs"
          variant="success"
        >
          Create direct offer
        </Button>
      </div>
    </div>
  );
};
