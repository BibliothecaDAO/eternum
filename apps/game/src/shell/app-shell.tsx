import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";

import { useIdentitySession } from "@/hooks/context/identity-session";

import { useFrontierType } from "@/ui/features/frontier/use-frontier-type";
import { useBootDocumentState } from "@/ui/modules/boot-loader";
import { useOutsidePlaySession } from "@/utils/spectator-session";

import { AppMusic } from "./app-music";

/**
 * Every screen outside a game, in the player app's one visual system. Each page composes itself with PageFrame; this
 * route marks the app ready, holds the type, plays the app's music when it is on and runs the signed-in player's
 * account sync. It carries no three.js and no game asset; a game loads only under
 * `/g/:chain/:game`.
 */
export const AppShell = () => {
  useBootDocumentState("app-ready");
  // Back from a spectated game, the signed-in player is no spectator here.
  useOutsidePlaySession();
  // The shell wears the player app's one visual system, the same as Frontier's HUD.
  useFrontierType();
  const { session } = useIdentitySession();
  return (
    <>
      <Outlet />
      <AppMusic />
      {session && (
        <Suspense fallback={null}>
          <AccountRuntime />
        </Suspense>
      )}
    </>
  );
};

/** The gameplay account syncs for a signed-in player on either layout; an anonymous visit never downloads it. */
const AccountRuntime = lazy(() => import("./account-runtime"));
