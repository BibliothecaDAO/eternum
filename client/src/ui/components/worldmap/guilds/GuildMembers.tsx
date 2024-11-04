import { ReactComponent as Crown } from "@/assets/icons/Crown.svg";
import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { useGuilds } from "@/hooks/helpers/useGuilds";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { ContractAddress, GuildMemberInfo, GuildWhitelistInfo, ID } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useCallback, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";

interface GuildMembersProps {
  selectedGuildEntityId: number;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  isOwner?: boolean;
  ownerAddress?: string;
}

export const GuildMembers = ({ selectedGuildEntityId, viewPlayerInfo }: GuildMembersProps) => {
  const {
    setup: {
      systemCalls: {
        join_guild,
        remove_guild_member,
        disband_guild,
        leave_guild,
        remove_player_from_whitelist,
        set_entity_name,
      },
    },
    account: { account },
  } = useDojo();

  const { useGuildMembers, getGuildFromPlayerAddress, useGuildWhitelist, usePlayerWhitelist, getGuildFromEntityId } =
    useGuilds();

  const { guildMembers } = useGuildMembers(selectedGuildEntityId);
  const invitedPlayers = useGuildWhitelist(selectedGuildEntityId);
  const userWhitelist = usePlayerWhitelist(ContractAddress(account.address));
  const userGuild = getGuildFromPlayerAddress(ContractAddress(account.address));
  const selectedGuild = getGuildFromEntityId(selectedGuildEntityId, ContractAddress(account.address));

  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewGuildInvites, setViewGuildInvites] = useState(false);

  const userIsGuildMaster = userGuild?.isOwner ? userGuild.entityId === selectedGuildEntityId : false;
  const userIsInvited = userWhitelist.find((list) => list.guildEntityId === selectedGuildEntityId);

  const removeGuildMember = useCallback((address: ContractAddress) => {
    setIsLoading(true);
    remove_guild_member({
      player_address_to_remove: address,
      signer: account,
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const leaveGuild = () => {
    setIsLoading(true);
    leave_guild({
      signer: account,
    }).finally(() => {
      setIsLoading(false);
    });
  };

  const disbandGuild = (guildEntityId: ID) => {
    let calldata = [
      ...guildMembers.filter((member) => !member.isGuildMaster).map((member) => ({ address: member.address })),
      { address: account.address },
    ];

    setIsLoading(true);
    disband_guild({
      calls: calldata,
      signer: account,
    }).finally(() => {
      setIsLoading(false);
    });
  };

  const joinGuild = useCallback((guildEntityId: ID) => {
    setIsLoading(true);
    join_guild({ guild_entity_id: guildEntityId, signer: account }).finally(() => setIsLoading(false));
  }, []);

  const removePlayerFromWhitelist = useCallback((address: string) => {
    setIsLoading(true);
    remove_player_from_whitelist({
      player_address_to_remove: address,
      guild_entity_id: selectedGuildEntityId,
      signer: account,
    }).finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="h-full w-full p-2">
      {editName ? (
        <div className="flex space-x-2">
          <TextInput placeholder="Type Name" className="h-full" onChange={(name) => setNaming(name)} />
          <Button
            variant="default"
            isLoading={isLoading}
            onClick={async () => {
              setIsLoading(true);

              try {
                await set_entity_name({ signer: account, entity_id: selectedGuildEntityId, name: naming });
              } catch (e) {
                console.error(e);
              }

              setIsLoading(false);
              setEditName(false);
            }}
          >
            Change Name
          </Button>
          <Pen
            className="ml-2 self-center m-auto w-12 h-12 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all"
            onClick={() => setEditName(!editName)}
          />
        </div>
      ) : (
        <div className="flex flex-row">
          <h3 className="truncate font-bold ">{selectedGuild?.name}</h3>
          {userIsGuildMaster && (
            <Pen
              className="ml-2 self-center m-auto w-6 h-6 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all"
              onClick={() => setEditName(!editName)}
            />
          )}
        </div>
      )}

      {userIsGuildMaster && (
        <Button className="my-4" variant="primary" onClick={() => setViewGuildInvites(!viewGuildInvites)}>
          {viewGuildInvites ? "Guild Members" : "Guild Invites"}
        </Button>
      )}

      {viewGuildInvites ? (
        <GuildInvitesList
          invitedPlayers={invitedPlayers}
          viewPlayerInfo={viewPlayerInfo}
          removePlayerFromWhitelist={() => removePlayerFromWhitelist}
        />
      ) : (
        <GuildMemberList
          guildMembers={guildMembers}
          viewPlayerInfo={viewPlayerInfo}
          userIsGuildMaster={userIsGuildMaster}
          removeGuildMember={removeGuildMember}
        />
      )}

      {userGuild?.entityId === selectedGuildEntityId && (
        <Button
          className="w-full my-4"
          isLoading={isLoading}
          variant="primary"
          onClick={() => (userGuild.isOwner ? disbandGuild(selectedGuildEntityId) : leaveGuild())}
        >
          {userGuild.isOwner ? "Disband Guild" : "Leave Guild"}
        </Button>
      )}
      {!userGuild && (!selectedGuild?.guild.isPublic ? userIsInvited : true) && (
        <Button
          className="w-full my-4"
          isLoading={isLoading}
          variant="primary"
          onClick={() => joinGuild(selectedGuildEntityId)}
        >
          Join Guild
        </Button>
      )}
    </div>
  );
};

interface GuildMemberListProps {
  guildMembers: GuildMemberInfo[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  userIsGuildMaster: boolean;
  removeGuildMember: (playerAddress: ContractAddress) => void;
}

const GuildMemberList = ({
  guildMembers,
  viewPlayerInfo,
  userIsGuildMaster,
  removeGuildMember,
}: GuildMemberListProps) => {
  return (
    <div className="flex flex-col p-2 border rounded-xl border-gold/10">
      <GuildMemberListHeader />
      <div className="flex flex-col space-y-2 overflow-y-auto">
        {guildMembers.map((guildMember) => (
          <GuildMemberRow
            key={guildMember.address}
            guildMember={guildMember}
            viewPlayerInfo={viewPlayerInfo}
            userIsGuildMaster={userIsGuildMaster}
            removeGuildMember={removeGuildMember}
          />
        ))}
      </div>
    </div>
  );
};

const GuildMemberListHeader = () => {
  return (
    <div className="grid grid-cols-6 gap-1 mb-4 uppercase text-xs font-bold border-b border-gold/10">
      <div>Rank</div>

      <div className="col-span-2">Name</div>

      <div className="text-right">Points</div>

      <div className="text-right">Age</div>
      <div></div>
    </div>
  );
};

interface GuildMemberRowProps {
  guildMember: GuildMemberInfo;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  userIsGuildMaster: boolean;
  removeGuildMember: (playerAddress: ContractAddress) => void;
}

const GuildMemberRow = ({ guildMember, viewPlayerInfo, userIsGuildMaster, removeGuildMember }: GuildMemberRowProps) => {
  return (
    <div className=" flex-row grid grid-cols-6">
      <div
        className={clsx("col-span-5 grid grid-cols-5 gap-1 text-md hover:opacity-70 p-1 rounded-xl", {
          "bg-blueish/20": guildMember.isUser,
        })}
        onClick={() => {
          viewPlayerInfo(ContractAddress(guildMember.address));
        }}
      >
        <p>{guildMember.rank}</p>
        <p className="col-span-2 flex flex-row">
          <span>{guildMember.isGuildMaster && <Crown className="w-6 fill-gold" />}</span>
          <span className="truncate">{guildMember.name}</span>
        </p>
        <p className="text-right">{currencyIntlFormat(guildMember.points)}</p>
        <p className="text-right text-sm">{guildMember.joinedSince}</p>
      </div>
      {userIsGuildMaster && !guildMember.isUser && (
        <Trash
          onClick={() => removeGuildMember(guildMember.address)}
          className="m-auto self-center w-5 fill-red/70 hover:scale-125 hover:animate-pulse duration-300 transition-all"
        />
      )}
    </div>
  );
};

const GuildInvitesList = ({
  invitedPlayers,
  viewPlayerInfo,
  removePlayerFromWhitelist,
}: {
  invitedPlayers: GuildWhitelistInfo[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  removePlayerFromWhitelist: (playerAddress: ContractAddress) => void;
}) => {
  return (
    <div className="flex flex-col p-2 border rounded-xl border-gold/10">
      <GuildMemberListHeader />
      <div className="flex flex-col space-y-2 overflow-y-auto">
        {invitedPlayers.map((player) => (
          <InviteRow
            key={player.address}
            player={player}
            viewPlayerInfo={viewPlayerInfo}
            removePlayerFromWhitelist={removePlayerFromWhitelist}
          />
        ))}
      </div>
      {!invitedPlayers.length && <p className="text-center italic">No Guild Invites Sent</p>}
    </div>
  );
};

interface InviteRowProps {
  player: GuildWhitelistInfo;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  removePlayerFromWhitelist: (playerAddress: ContractAddress) => void;
}

const InviteRow = ({ player, viewPlayerInfo, removePlayerFromWhitelist }: InviteRowProps) => {
  return (
    <div className="flex flex-row grid grid-cols-5">
      <div
        className={clsx("col-span-4 grid grid-cols-4 gap-1 text-md hover:opacity-70 hover:border p-1 rounded-xl", {})}
        onClick={() => {
          viewPlayerInfo(ContractAddress(player.address!));
        }}
      >
        <p>{player.rank}</p>
        <p className="col-span-2 flex flex-row">
          <span className="truncate">{player.name}</span>
        </p>
        <p className="text-right">{currencyIntlFormat(player.points!)}</p>
      </div>

      <Trash
        onClick={() => removePlayerFromWhitelist(player.address!)}
        className="m-auto self-center w-5 fill-red/70 hover:scale-125 hover:animate-pulse duration-300 transition-all"
      />
    </div>
  );
};
