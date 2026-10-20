import { MAX_NAME_LENGTH } from "@bibliothecadao/types";
import { HudButton, HudField, HudIconButton } from "@/ui/design-system/kit/hud-elements";

interface CreateGuildButtonProps {
  handleCreateGuild: (guildName: string, isPublic: boolean) => void;
  guildName: string;
  setGuildName: (val: string) => void;
  isPublic: boolean;
  setIsPublic: (val: boolean) => void;
}

export const CreateGuildButton = ({
  handleCreateGuild,
  guildName,
  setGuildName,
  isPublic,
  setIsPublic,
}: CreateGuildButtonProps) => {
  const handleSubmit = () => {
    handleCreateGuild(guildName, isPublic);
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <HudField
        placeholder="Tribe Name . . ."
        aria-label="Tribe name"
        value={guildName}
        onChange={setGuildName}
        maxLength={MAX_NAME_LENGTH}
      />
      <div className="flex items-center gap-2 sm:shrink-0">
        <HudIconButton
          icon={isPublic ? "unlock" : "lock"}
          label={isPublic ? "Public" : "Private"}
          onClick={() => setIsPublic(!isPublic)}
        />

        <HudButton kind="primary" onClick={handleSubmit} disabled={!guildName}>
          Confirm
        </HudButton>
      </div>
    </div>
  );
};
