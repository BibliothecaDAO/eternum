import React, { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import { Headline } from "../../../../../elements/Headline";
import { ResourcesIds, findResourceById, resources } from "@bibliothecadao/eternum";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import Button from "../../../../../elements/Button";
import { FilterButton } from "../../../../../elements/FilterButton";
import { SortPanel } from "../../../../../elements/SortPanel";
import { currencyIntlFormat, formatTimeLeftDaysHoursMinutes } from "../../../../../utils/utils";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import { OnlineStatus } from "../../../../../elements/OnlineStatus";
import { useLabor } from "../../../../../hooks/helpers/useLabor";

type DirectOffersExplorerPopupProps = {
  onClose: () => void;
};

export const DirectOffersExplorerPopup = ({ onClose }: DirectOffersExplorerPopupProps) => {
  const [selectedResourceId, setSelectedResourceId] = useState<any>(null);

  useEffect(() => {}, []);

  return (
    <>
      <SecondaryPopup name="direct-offers-explorer">
        <SecondaryPopup.Head onClose={onClose}>
          <div className="flex items-center space-x-1">
            <div className="mr-0.5">Marketplace</div>
          </div>
        </SecondaryPopup.Head>
        <SecondaryPopup.Body width={"660px"}>
          {selectedResourceId ? (
            <RealmResourceExplorerPanel resourceId={selectedResourceId} />
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

const RealmResourceExplorerPanel = ({ resourceId }: { resourceId: number }) => {
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

  return (
    <>
      <div className="flex flex-col p-2">
        <div className="flex items-center justify-between">
          <FiltersPanel>
            <FilterButton active={true} onClick={() => {}}>
              Resource: {findResourceById(resourceId)?.trait}
            </FilterButton>
          </FiltersPanel>
          <Button onClick={() => {}} variant="primary">
            + Create a new offer
          </Button>
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
        <div className="mt-2">
          <RealmResourceRow realmEntityId={} />
        </div>
      </div>
    </>
  );
};

type RealmResourceRowProps = {
  realmEntityId: bigint;
};

const RealmResourceRow = ({ realmEntityId }: RealmResourceRowProps) => {
  const { getLatestRealmActivity } = useLabor();

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
        <ResourceIcon containerClassName="mr-2 w-min" withTooltip={false} resource={"Fish"} size="sm" />
        {currencyIntlFormat(1000000)}
      </div>
      <div className="flex mr-auto items-center text-light-pink">
        <OnlineStatus status={status} className="mr-2" />
        {latestActivity && <div>{`${formatTimeLeftDaysHoursMinutes(latestActivity)} ago`}</div>}
        <OrderIcon className="mr-2" size="xs" order="fox" />
        Machomanisland
      </div>

      <div className="flex items-center justify-end text-lightest">
        100 km <div className="text-light-pink inline-block ml-2">(12m)</div>
        <Button className="ml-2" onClick={() => {}} disabled={false} size="xs" variant="success">
          Create direct offer
        </Button>
      </div>
    </div>
  );
};
