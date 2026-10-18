import { env } from "../../../env";

/**
 * The build the client runs, in the desktop HUD's base band: the strip of screen under the columns
 * (`bottom-hud-base`), which nothing in the HUD covers, at the right column's edge.
 */
export const BuildTag = () => (
  <div className="pointer-events-auto absolute bottom-0 right-3 h-hud-base text-hud-label text-hud-cue hover:text-hud-ink max-lg:hidden">
    <a target="_blank" href={"https://github.com/BibliothecaDAO/eternum"} rel="noopener noreferrer">
      {env.VITE_PUBLIC_GAME_VERSION}
    </a>
  </div>
);
