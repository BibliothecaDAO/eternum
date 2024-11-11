import { useGuilds } from "@/hooks/helpers/useGuilds";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { ContractAddress, ID } from "@bibliothecadao/eternum";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { CreateGuildButton } from "./CreateGuildButton";
import { GuildList } from "./GuildList";

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
  const playerGuild = getGuildFromPlayerAddress(ContractAddress(account.address));

  const showGuildButton = playerGuild?.entityId;

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
        <GuildList guilds={filteredGuilds} viewGuildInvites={viewGuildInvites} viewGuildMembers={viewGuildMembers} />
      </div>
    </div>
  );
};
