import { Outlet } from "react-router-dom";

import { useFrontierType } from "@/ui/features/frontier/use-frontier-type";
import { useBootDocumentState } from "@/ui/modules/boot-loader";
import { useOutsidePlaySession } from "@/utils/spectator-session";

/**
 * Every screen outside a game, in the player app's one visual system. Each page composes itself with PageFrame; this
 * route only marks the app ready and holds the type. It carries no three.js and no game asset; a game loads only under
 * `/g/:chain/:game`.
 */
export const AppShell = () => {
  useBootDocumentState("app-ready");
  // Back from a spectated game, the signed-in player is no spectator here.
  useOutsidePlaySession();
  // The shell wears the player app's one visual system, the same as Frontier's HUD.
  useFrontierType();
  return <Outlet />;
};
