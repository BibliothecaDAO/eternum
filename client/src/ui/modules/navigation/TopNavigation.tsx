import { useGetAllPlayers } from "@/hooks/helpers/useGetAllPlayers";
import useUIStore from "@/hooks/store/useUIStore";
import { Questing } from "../questing/Questing";
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
        <SettingsWindow />
      </div>
    </>
  );
};
