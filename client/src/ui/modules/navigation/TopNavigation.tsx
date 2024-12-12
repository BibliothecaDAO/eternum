import { useGetAllPlayers } from "@/hooks/helpers/use-get-all-players";

import { memo } from "react";
import { Rewards } from "../rewards/Rewards";
import { SettingsWindow } from "../settings/Settings";
import { Social } from "../social/Social";

export const TopMiddleNavigation = memo(() => {
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
});
