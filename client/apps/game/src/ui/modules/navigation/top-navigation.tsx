import { Rewards } from "@/ui/modules/rewards/rewards";
import { SettingsWindow } from "@/ui/modules/settings/settings";
import { Social } from "@/ui/modules/social/social";
import { useGetAllPlayers } from "@bibliothecadao/react";
import { memo } from "react";
import { env } from "../../../../env";

export const TopMiddleNavigation = memo(() => {
  const getPlayers = useGetAllPlayers({ viteLordsAddress: env.VITE_LORDS_ADDRESS });

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
