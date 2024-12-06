import { useGuilds } from "@/hooks/helpers/useGuilds";
import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { SortButton, SortInterface } from "@/ui/elements/SortButton";
import { SortPanel } from "@/ui/elements/SortPanel";
import TextInput from "@/ui/elements/TextInput";
import { currencyIntlFormat, sortItems } from "@/ui/utils/utils";
import { ContractAddress, GuildInfo, ID, Player, ResourcesIds } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { ChevronRight, LockOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { CreateGuildButton } from "./CreateGuildButton";

export const Guilds = ({
  viewGuildMembers,
  players,
}: {
  viewGuildMembers: (guildEntityId: ID) => void;
  players: Player[];
}) => {
  const {
    setup: {
      systemCalls: { create_guild },
    },
    account: { account },
  } = useDojo();

  const { useGuildQuery, getGuildFromPlayerAddress, usePlayerWhitelist } = useGuilds();

  const { guilds } = useGuildQuery();
  const guildInvites = usePlayerWhitelist(ContractAddress(account.address));
  const playerGuild = getGuildFromPlayerAddress(ContractAddress(account.address));

  const showGuildButton = playerGuild?.entityId;

  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingGuild, setIsCreatingGuild] = useState(false);
  const [viewGuildInvites, setViewGuildInvites] = useState(false);
  const [guildSearchTerm, setGuildSearchTerm] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [guildName, setGuildName] = useState("");
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "rank",
    sort: "asc",
  });

  // Aggregate player data per guild
  const guildsWithStats = useMemo(() => {
    const guildStats = new Map<
      string,
      {
        totalPoints: number;
        totalLords: number;
        totalRealms: number;
        totalMines: number;
        totalHypers: number;
        memberCount: number;
      }
    >();

    players.forEach((player) => {
      const guild = getGuildFromPlayerAddress(player.address);
      if (guild) {
        const stats = guildStats.get(guild.entityId.toString()) || {
          totalPoints: 0,
          totalLords: 0,
          totalRealms: 0,
          totalMines: 0,
          totalHypers: 0,
          memberCount: 0,
        };

        stats.totalPoints += player.points || 0;
        stats.totalLords += player.lords || 0;
        stats.totalRealms += player.realms || 0;
        stats.totalMines += player.mines || 0;
        stats.totalHypers += player.hyperstructures || 0;
        stats.memberCount++;

        guildStats.set(guild.entityId.toString(), stats);
      }
    });

    return guilds
      .map((guild) => {
        const stats = guildStats.get(guild.entityId.toString()) || {
          totalPoints: 0,
          totalLords: 0,
          totalRealms: 0,
          totalMines: 0,
          totalHypers: 0,
          memberCount: 0,
        };
        return {
          ...guild,
          points: stats.totalPoints,
          lords: stats.totalLords,
          realms: stats.totalRealms,
          mines: stats.totalMines,
          hyperstructures: stats.totalHypers,
          memberCount: stats.memberCount,
        };
      })
      .sort((a, b) => b.points - a.points)
      .map((guild, index) => ({ ...guild, rank: index + 1 }));
  }, [guilds, players]);

  const filteredGuilds = useMemo(
    () =>
      sortItems(
        guildsWithStats.filter((guild) => {
          const nameMatch = guild.name.toLowerCase().startsWith(guildSearchTerm.toLowerCase());
          if (viewGuildInvites) {
            return nameMatch && guildInvites.some((invite) => invite.guildEntityId === guild.entityId);
          }
          return nameMatch;
        }),
        activeSort,
        { sortKey: "rank", sort: "asc" },
      ),
    [guildsWithStats, guildSearchTerm, guildInvites, viewGuildInvites, activeSort],
  );

  const handleCreateGuild = (guildName: string, isPublic: boolean) => {
    setIsLoading(true);
    setIsCreatingGuild(false);
    create_guild({
      is_public: isPublic,
      guild_name: guildName,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  const toggleIsCreatingGuild = () => {
    setIsCreatingGuild((prev) => !prev);
    if (!isCreatingGuild) {
      setIsPublic(true);
      setGuildName("");
    } else {
      setGuildSearchTerm("");
    }
  };

  return (
    <div className="flex flex-col min-h-72 h-full w-full p-2 overflow-hidden">
      {showGuildButton ? (
        <Button
          className="text-ellipsis uppercase font-sans !bg-blueish/20 hover:!bg-gold"
          variant="primary"
          onClick={() => viewGuildMembers(playerGuild.entityId)}
        >
          {playerGuild.name}
          <ChevronRight className="w-4 h-4" />
        </Button>
      ) : (
        <Button isLoading={isLoading} variant="primary" onClick={toggleIsCreatingGuild}>
          {isCreatingGuild ? "Search Tribe" : "Create Tribe"}
        </Button>
      )}

      <Button className="my-4" variant="primary" onClick={() => setViewGuildInvites(!viewGuildInvites)}>
        {viewGuildInvites ? "Tribe Rankings" : "Tribe Invites"}
      </Button>

      <div className="mb-4">
        {isCreatingGuild ? (
          <CreateGuildButton
            handleCreateGuild={handleCreateGuild}
            guildName={guildName}
            setGuildName={setGuildName}
            isPublic={isPublic}
            setIsPublic={setIsPublic}
          />
        ) : (
          <TextInput
            placeholder="Search Tribe . . ."
            onChange={(guildSearchTerm) => setGuildSearchTerm(guildSearchTerm)}
          />
        )}
      </div>

      <div className="flex-1 min-h-0">
        <div className="flex flex-col h-full p-2 bg-brown-900/50 border border-gold/30 rounded-xl backdrop-blur-sm">
          <GuildListHeader activeSort={activeSort} setActiveSort={setActiveSort} />
          <div className="mt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
            {filteredGuilds.map((guild) => (
              <GuildRow key={guild.entityId} guild={guild} onClick={() => viewGuildMembers(guild.entityId)} />
            ))}
            {!filteredGuilds.length && viewGuildInvites && (
              <p className="text-center italic">No Tribe Invites Received</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const GuildListHeader = ({
  activeSort,
  setActiveSort,
}: {
  activeSort: SortInterface;
  setActiveSort: (_sort: SortInterface) => void;
}) => {
  const sortingParams = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank", className: "col-span-1 text-center px-1" },
      { label: "Name", sortKey: "name", className: "col-span-2 px-1" },
      { label: "Realms", sortKey: "realms", className: "col-span-1 text-center px-1" },
      { label: "Mines", sortKey: "mines", className: "col-span-1 text-center px-1" },
      { label: "Hypers", sortKey: "hyperstructures", className: "col-span-1 text-center px-1" },
      { label: "Members", sortKey: "memberCount", className: "col-span-1 text-center px-1" },
      { label: "Points", sortKey: "points", className: "col-span-2 text-center px-1" },
      {
        label: (
          <div className="flex flex-row w-full gap-1 items-center justify-center">
            LORDS
            <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="w-5 h-5" />
          </div>
        ),
        sortKey: "lords",
        className: "col-span-2 text-center px-1",
      },
      { label: "Status", sortKey: "isPublic", className: "col-span-1 text-center px-1" },
    ];
  }, []);

  const textStyle = "text-sm font-semibold tracking-wide text-gold/90 uppercase w-full";

  return (
    <SortPanel className="grid grid-cols-12 pb-3 border-b border-gold/20">
      {sortingParams.map(({ label, sortKey, className }) => (
        <SortButton
          key={sortKey}
          label={label}
          sortKey={sortKey}
          activeSort={activeSort}
          className={`${className} ${textStyle}`}
          classNameCaret="w-2.5 h-2.5 ml-1"
          onChange={(_sortKey, _sort) => {
            setActiveSort({
              sortKey: _sortKey,
              sort: _sort,
            });
          }}
        />
      ))}
    </SortPanel>
  );
};

const GuildRow = ({
  guild,
  onClick,
}: {
  guild: GuildInfo & {
    lords: number;
    realms: number;
    mines: number;
    hyperstructures: number;
    rank: number;
  };
  onClick: () => void;
}) => {
  return (
    <div
      className={clsx(
        "grid grid-cols-12 w-full py-1 cursor-pointer items-center hover:bg-gold/5 rounded-lg transition-colors duration-200 mb-1",
        {
          "bg-blueish/20 hover:bg-blueish/30": guild.isMember,
        },
      )}
      onClick={onClick}
    >
      <p className="col-span-1 text-center font-medium italic px-1">#{guild.rank}</p>
      <p className="col-span-2 truncate font-semibold text-gold/90 px-1">{guild.name}</p>
      <p className="col-span-1 text-center font-medium px-1">{guild.realms}</p>
      <p className="col-span-1 text-center font-medium px-1">{guild.mines}</p>
      <p className="col-span-1 text-center font-medium px-1">{guild.hyperstructures}</p>
      <p className="col-span-1 text-center font-medium px-1">{guild.memberCount}</p>
      <p className="col-span-2 font-medium text-amber-200/90 px-1 text-center">
        {currencyIntlFormat(guild?.points || 0)}
      </p>
      <div className="col-span-2 font-medium text-gold/90 px-1 flex items-center gap-1 justify-center">
        {currencyIntlFormat(guild.lords)}
        <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="w-5 h-5" />
      </div>
      <div className="col-span-1 flex justify-center">
        {guild.isPublic ? <LockOpen className="w-4 h-4 text-gold" /> : <LockOpen className="w-4 h-4 text-gold/50" />}
      </div>
    </div>
  );
};
