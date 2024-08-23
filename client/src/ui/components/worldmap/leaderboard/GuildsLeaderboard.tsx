import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useGuilds } from "@/hooks/helpers/useGuilds";
import { ContractAddress } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { GuildPointsLeaderboardInterface } from "../../../../hooks/store/useLeaderBoardStore";
import Button from "../../../elements/Button";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import { currencyIntlFormat, sortItems } from "../../../utils/utils";
import useUIStore from "@/hooks/store/useUIStore";

type GuildPointsLeaderboardKeys = keyof GuildPointsLeaderboardInterface;

interface SortingParamGuildPointsLeaderboard {
  label: string;
  sortKey: GuildPointsLeaderboardKeys;
  className?: string;
}

export const GuildsLeaderboard = () => {
  const {
    account: { account },
  } = useDojo();

  const { getGuildFromPlayerAddress, getGuildFromEntityId } = useGuilds();

  const [loading, _] = useState(false);
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const sortingParams: SortingParamGuildPointsLeaderboard[] = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank", className: "col-span-1" },
      { label: "Name", sortKey: "name", className: "col-span-2" },
      { label: "Points", sortKey: "totalPoints", className: "col-span-1" },
    ];
  }, []);

  const guildLeaderboard = useMemo(() => {
    return LeaderboardManager.instance().getGuildsByRank(
      useUIStore.getState().nextBlockTimestamp!,
      getGuildFromPlayerAddress,
    );
  }, []);

  return (
    <div className="flex flex-col">
      <SortPanel className="px-3 py-2 grid grid-cols-4 gap-4">
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
      {!loading && (
        <div className="flex flex-col p-3 space-y-2 overflow-y-auto">
          {sortItems(guildLeaderboard, activeSort).map(([guildEntityId, points], index) => {
            const guild = getGuildFromEntityId(guildEntityId, ContractAddress(account.address));
            if (!guild) return;

            return (
              <div
                key={index}
                className={`grid grid-cols-4 gap-4  p-1 ${guild.isOwner ? "bg-green/20" : ""}  text-xxs text-gold`}
              >
                <div className="col-span-1">{`#${index + 1}`}</div>
                <div className="col-span-2">{guild.name}</div>
                <div className="col-span-1"> {currencyIntlFormat(points, 0)}</div>
              </div>
            );
          })}
        </div>
      )}
      {loading && (
        <div className="flex justify-center items-center min-h-[50px]">
          (
          <Button isLoading={true} onClick={() => {}} variant="danger" className="p-2 !h-4 text-xxs !rounded-md">
            {" "}
            {}{" "}
          </Button>
          )
        </div>
      )}
    </div>
  );
};
