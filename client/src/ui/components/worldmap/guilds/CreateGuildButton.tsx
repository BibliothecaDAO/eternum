import { ReactComponent as LockClosed } from "@/assets/icons/common/lock-closed.svg";
import { ReactComponent as LockOpen } from "@/assets/icons/common/lock-open.svg";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { MAX_NAME_LENGTH } from "@bibliothecadao/eternum";

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
    <div className="flex items-center gap-4">
      <TextInput placeholder="Tribe Name . . ." onChange={setGuildName} maxLength={MAX_NAME_LENGTH} />
      <div className="flex items-center gap-2">
        <div className={"flex items-center justify-center h-full"} onClick={() => setIsPublic(!isPublic)}>
          {isPublic ? (
            <LockOpen
              className="fill-gold w-6 h-6 hover:opacity-70"
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
              className="fill-gold/50 w-6 h-6 hover:opacity-70"
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

        <Button variant="primary" onClick={handleSubmit} disabled={!guildName}>
          Confirm
        </Button>
      </div>
    </div>
  );
};
