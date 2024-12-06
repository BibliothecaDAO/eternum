import { useGetAllPlayers } from "@/hooks/helpers/use-get-all-players";
import useUIStore from "@/hooks/store/useUIStore";
import { Questing } from "../questing/Questing";
import { Rewards } from "../rewards/Rewards";
import { SettingsWindow } from "../settings/Settings";
import { Social } from "../social/Social";

export const TopMiddleNavigation = () => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const getPlayers = useGetAllPlayers();
  const players = getPlayers();

  return (
    <>
      <div className="pointer-events-auto">
        <Questing entityId={structureEntityId} />
        <Social players={players} />
        <Rewards />
        <SettingsWindow />
      </div>
    </>
  );
};
