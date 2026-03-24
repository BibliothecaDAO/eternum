import { ReactComponent as LockClosed } from "@/assets/icons/common/lock-closed.svg";
import { ReactComponent as LockOpen } from "@/assets/icons/common/lock-open.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import TextInput from "@/ui/design-system/atoms/text-input";
import { MAX_NAME_LENGTH } from "@bibliothecadao/types";

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
  const setTooltip = useUIStore((state) => state.setTooltip);

  const handleSubmit = () => {
    handleCreateGuild(guildName, isPublic);
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <TextInput
        placeholder="Tribe Name . . ."
        onChange={setGuildName}
        maxLength={MAX_NAME_LENGTH}
        className="w-full button-wood"
      />
      <div className="flex items-center gap-2 sm:shrink-0">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-md border border-gold/30 bg-black/20 transition-colors hover:bg-gold/10"
          onClick={() => setIsPublic(!isPublic)}
        >
          {isPublic ? (
            <LockOpen
              className="h-4 w-4 fill-gold"
              onMouseEnter={() => {
                setTooltip({
                  position: "bottom",
                  content: <>Public</>,
                });
              }}
              onMouseLeave={() => {
                setTooltip(null);
              }}
            />
          ) : (
            <LockClosed
              className="h-4 w-4 fill-gold/60"
              onMouseEnter={() => {
                setTooltip({
                  position: "bottom",
                  content: <>Private</>,
                });
              }}
              onMouseLeave={() => {
                setTooltip(null);
              }}
            />
          )}
        </button>

        <Button variant="primary" onClick={handleSubmit} disabled={!guildName} className="min-w-[120px]">
          Confirm
        </Button>
      </div>
    </div>
  );
};
