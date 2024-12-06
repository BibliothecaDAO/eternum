import { useGetAllPlayers } from "@/hooks/helpers/use-get-all-players";

import { Rewards } from "../rewards/Rewards";
import { SettingsWindow } from "../settings/Settings";
import { Social } from "../social/Social";

export const TopMiddleNavigation = () => {
  const getPlayers = useGetAllPlayers();
  const players = getPlayers();

  return (
    <>
      <div className="pointer-events-auto">
        <Social players={players} />
        <Rewards />
        <SettingsWindow />
      </div>
    </>
  );
};
