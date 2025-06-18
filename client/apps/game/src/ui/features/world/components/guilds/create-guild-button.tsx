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
    <div className="flex flex-col sm:flex-row w-full items-center gap-4">
      <TextInput
        placeholder="Tribe Name . . ."
        onChange={setGuildName}
        maxLength={MAX_NAME_LENGTH}
        className="w-full"
      />
      <div className="flex items-center gap-2 mt-2 sm:mt-0">
        <div
          className="flex items-center justify-center p-2 rounded-md border border-gold/30 hover:bg-gold/10 transition-colors cursor-pointer"
          onClick={() => setIsPublic(!isPublic)}
        >
          {isPublic ? (
            <LockOpen
              className="fill-gold w-5 h-5"
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
              className="fill-gold/60 w-5 h-5"
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
        </div>

        <Button variant="primary" onClick={handleSubmit} disabled={!guildName} className="min-w-24">
          Confirm
        </Button>
      </div>
    </div>
  );
};
