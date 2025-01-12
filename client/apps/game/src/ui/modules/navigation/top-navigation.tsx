import { useGetAllPlayers } from "@/hooks/helpers/use-get-all-players";
import { Rewards } from "@/ui/modules/rewards/rewards";
import { SettingsWindow } from "@/ui/modules/settings/settings";
import { Social } from "@/ui/modules/social/social";
import { memo } from "react";

export const TopMiddleNavigation = memo(() => {
  const getPlayers = useGetAllPlayers();

  return (
    <>
      <div className="pointer-events-auto">
        <Social getPlayers={getPlayers} />
        <Rewards />
        <SettingsWindow />
      </div>
    </>
  );
});
