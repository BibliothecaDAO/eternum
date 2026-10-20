import { env } from "../../../env";

const REPOSITORY = "https://github.com/BibliothecaDAO/eternum";
/** A deploy's version is its full git commit (deploy/first/publish.ts); a local build's is a name ("athanor"). */
const COMMIT = /^[0-9a-f]{40}$/i;

/**
 * The build the client runs, in the desktop HUD's base band: the strip of screen under the columns
 * (`bottom-hud-base`), which nothing in the HUD covers, at the right column's edge. A commit reads as git's short form
 * and links to that commit (live-qa-night-1 P3-9: the full 40 characters ran under the chat strip); a named build reads
 * as its name. Every environment shows it, production too: a report names the build it saw.
 */
export const BuildTag = () => {
  const version = env.VITE_PUBLIC_GAME_VERSION;
  if (!version) return null;
  const commit = COMMIT.test(version);
  return (
    <div className="pointer-events-auto absolute bottom-0 right-3 h-hud-base text-hud-label text-hud-cue hover:text-hud-ink max-lg:hidden">
      <a target="_blank" href={commit ? `${REPOSITORY}/commit/${version}` : REPOSITORY} rel="noopener noreferrer">
        {commit ? version.slice(0, 7) : version}
      </a>
    </div>
  );
};
