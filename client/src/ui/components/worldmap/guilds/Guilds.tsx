import { ReactComponent as LockClosed } from "@/assets/icons/common/lock-closed.svg";
import { ReactComponent as LockOpen } from "@/assets/icons/common/lock-open.svg";
import { useGuilds } from "@/hooks/helpers/useGuilds";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { ContractAddress, GuildInfo, ID, MAX_NAME_LENGTH } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";

export const Guilds = ({ viewGuildMembers }: { viewGuildMembers: (guildEntityId: ID) => void }) => {
  const {
    setup: {
      systemCalls: { create_guild },
    },
    account: { account },
  } = useDojo();

  const { useGuildQuery, getGuildFromPlayerAddress, usePlayerWhitelist } = useGuilds();

  const { guilds } = useGuildQuery();
  const guildInvites = usePlayerWhitelist(ContractAddress(account.address));
  const userGuild = getGuildFromPlayerAddress(ContractAddress(account.address));

  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingGuild, setIsCreatingGuild] = useState(false);
  const [viewGuildInvites, setViewGuildInvites] = useState(false);
  const [guildSearchTerm, setGuildSearchTerm] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [guildName, setGuildName] = useState("");

  const filteredGuilds = useMemo(
    () =>
      guilds.filter((guild) => {
        const nameMatch = guild.name.toLowerCase().startsWith(guildSearchTerm.toLowerCase());
        if (viewGuildInvites) {
          return nameMatch && guildInvites.some((invite) => invite.guildEntityId === guild.entityId);
        }
        return nameMatch;
      }),
    [guilds, guildSearchTerm, guildInvites, viewGuildInvites],
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
    <div className="flex flex-col min-h-72 p-2 h-full w-full">
      <GuildActionButton
        userGuild={userGuild}
        isLoading={isLoading}
        isCreatingGuild={isCreatingGuild}
        viewGuildMembers={viewGuildMembers}
        toggleIsCreatingGuild={toggleIsCreatingGuild}
      />

      <Button className="my-4" variant="default" onClick={() => setViewGuildInvites(!viewGuildInvites)}>
        {viewGuildInvites ? "Guild Rankings" : "Guild Invites"}
      </Button>

      <div className="mb-4">
        <GuildSearchOrCreate
          isCreatingGuild={isCreatingGuild}
          handleCreateGuild={handleCreateGuild}
          guildName={guildName}
          setGuildName={setGuildName}
          isPublic={isPublic}
          setIsPublic={setIsPublic}
          setGuildSearchTerm={setGuildSearchTerm}
        />
      </div>

      <GuildList guilds={filteredGuilds} viewGuildInvites={viewGuildInvites} viewGuildMembers={viewGuildMembers} />
    </div>
  );
};

interface GuildActionButtonProps {
  userGuild: GuildInfo | undefined;
  isLoading: boolean;
  isCreatingGuild: boolean;
  viewGuildMembers: (guildEntityId: ID) => void;
  toggleIsCreatingGuild: () => void;
}
const GuildActionButton = ({
  userGuild,
  isLoading,
  isCreatingGuild,
  viewGuildMembers,
  toggleIsCreatingGuild,
}: GuildActionButtonProps) => {
  if (userGuild) {
    return (
      <Button
        className="text-ellipsis uppercase font-sans"
        variant="primary"
        onClick={() => viewGuildMembers(userGuild.entityId)}
      >
        {userGuild.name}
        <ChevronRight className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button isLoading={isLoading} variant="primary" onClick={toggleIsCreatingGuild}>
      {isCreatingGuild ? "Search Guild" : "Create Guild"}
    </Button>
  );
};

interface GuildSearchOrCreateProps {
  isCreatingGuild: boolean;
  handleCreateGuild: (guildName: string, isPublic: boolean) => void;
  guildName: string;
  setGuildName: (val: string) => void;
  isPublic: boolean;
  setIsPublic: (val: boolean) => void;
  setGuildSearchTerm: (term: string) => void;
}

const GuildSearchOrCreate = ({
  isCreatingGuild,
  handleCreateGuild,
  guildName,
  setGuildName,
  isPublic,
  setIsPublic,
  setGuildSearchTerm,
}: GuildSearchOrCreateProps) => {
  if (isCreatingGuild) {
    return (
      <CreateGuildForm
        handleCreateGuild={handleCreateGuild}
        guildName={guildName}
        setGuildName={setGuildName}
        isPublic={isPublic}
        setIsPublic={setIsPublic}
      />
    );
  }

  return (
    <TextInput placeholder="Search Guild . . ." onChange={(guildSearchTerm) => setGuildSearchTerm(guildSearchTerm)} />
  );
};

interface GuildListProps {
  guilds: GuildInfo[];
  viewGuildInvites: boolean;
  viewGuildMembers: (guildEntityId: ID) => void;
}

const GuildList = ({ guilds, viewGuildInvites, viewGuildMembers }: GuildListProps) => {
  return (
    <div className="flex flex-col p-2 border border-gold/10 rounded h-full">
      <GuildListHeader />
      <div className="flex flex-col space-y-2 overflow-y-auto">
        {guilds.map((guild) => (
          <GuildRow key={guild.entityId} guild={guild} onClick={() => viewGuildMembers(guild.entityId)} />
        ))}
      </div>
      {!guilds.length && viewGuildInvites && <p className="text-center italic">No Guild Invites Received</p>}
    </div>
  );
};

const GuildListHeader = () => (
  <div className="grid grid-cols-7 gap-1 mb-4 uppercase text-xs font-bold border-b">
    <div>Rank</div>
    <div className="col-span-2">Name</div>
    <div>Points</div>
    <div className="text-right">Members</div>
    <div className="text-right">Age</div>
  </div>
);

interface GuildRowProps {
  guild: GuildInfo;
  onClick: () => void;
}

const GuildRow = ({ guild, onClick }: GuildRowProps) => {
  return (
    <div
      className={clsx("grid grid-cols-7  gap-1 text-md hover:opacity-70 p-1 rounded", {
        "bg-blueish/20": guild.isMember,
      })}
      onClick={onClick}
    >
      <p>{guild.rank}</p>
      <p className="col-span-2 truncate">{guild.name}</p>
      <p>{currencyIntlFormat(guild.points!)}</p>
      <p className="text-right">{guild.memberCount}</p>
      <p className="text-right text-sm">{guild.createdSince}</p>
      <div className="flex justify-end">{!guild.isPublic && <LockClosed className="fill-gold w-4" />}</div>
    </div>
  );
};

interface CreateGuildFormProps {
  handleCreateGuild: (guildName: string, isPublic: boolean) => void;
  guildName: string;
  setGuildName: (val: string) => void;
  isPublic: boolean;
  setIsPublic: (val: boolean) => void;
}

const CreateGuildForm = ({
  handleCreateGuild,
  guildName,
  setGuildName,
  isPublic,
  setIsPublic,
}: CreateGuildFormProps) => {
  const handleSubmit = () => {
    handleCreateGuild(guildName, isPublic);
  };

  return (
    <div className="flex items-center gap-4">
      <TextInput placeholder="Guild Name . . ." onChange={setGuildName} maxLength={MAX_NAME_LENGTH} />
      <div className="flex items-center gap-2">
        <div className={"flex items-center justify-center h-full"} onClick={() => setIsPublic(!isPublic)}>
          {isPublic ? (
            <LockOpen className="fill-gold w-6 h-6 hover:opacity-70" />
          ) : (
            <LockClosed className="fill-gold w-6 h-6 hover:opacity-70" />
          )}
        </div>

        <Button variant="primary" onClick={handleSubmit} disabled={!guildName}>
          Confirm
        </Button>
      </div>
    </div>
  );
};
