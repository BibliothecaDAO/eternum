import { useIdentitySession } from "@/hooks/context/identity-session";

import { useDirectory } from "./herald";
import { ErrorPanel, Loading } from "./kit";
import { BlitzLobbyCard, EternumCard, FrontierCard } from "./mode-cards";
import { chooseSeason } from "./season";
import { useNowSeconds } from "./use-now";

/**
 * The games (design o4, o12): the modes as painted cards with their live state. Frontier's season with Enter, every
 * Blitz as a row with its seats and one action, and Eternum greyed until it opens. On desktop Frontier stands large
 * beside Blitz and Eternum.
 */
export const PlayPage = () => {
  const { status } = useIdentitySession();
  const now = useNowSeconds();
  const directory = useDirectory();

  if (directory.isError)
    return (
      <ErrorPanel
        message="Games are unavailable right now."
        error={directory.error}
        retry={() => void directory.refetch()}
      />
    );
  if (directory.isPending || status === "loading") return <Loading />;
  const games = directory.data.games;
  const season = chooseSeason(games, status === "signed-in");

  return (
    <div className="grid gap-3 pt-2 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start lg:gap-4 lg:pt-8">
      {season && <FrontierCard season={season} className="h-44 lg:row-span-2 lg:h-[32rem]" />}
      <BlitzLobbyCard games={games} now={now} />
      <EternumCard games={games} now={now} className="h-32 lg:h-40" />
    </div>
  );
};
