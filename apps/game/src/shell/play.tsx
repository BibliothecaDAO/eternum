import { useIdentitySession } from "@/hooks/context/identity-session";

import { useDirectory } from "./herald";
import { Loading } from "./kit";
import { ServiceFailure } from "./service-failure";
import { BlitzLobbyCard, EternumCard, FrontierCard } from "./mode-cards";
import { chooseSeason } from "./season";
import { useNowSeconds } from "./use-now";
import { PageFrame } from "./frame/page-frame";

/**
 * The games (design o4, o12): the modes as painted cards with their live state. Frontier's season with Enter, every
 * Blitz as a row with its seats and one action, and Eternum greyed until it opens. On desktop Frontier stands large
 * beside Blitz and Eternum.
 */
const PlayBody = () => {
  const { status } = useIdentitySession();
  const now = useNowSeconds();
  const directory = useDirectory();

  if (directory.isError)
    return <ServiceFailure service="directory" error={directory.error} retry={() => void directory.refetch()} />;
  if (directory.isPending || status === "loading") return <Loading />;
  const games = directory.data.games;
  const season = chooseSeason(games, status === "signed-in");

  return (
    <div className="grid gap-3 pt-2 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start lg:gap-4 lg:pt-8">
      {season && <FrontierCard season={season} className="h-44 lg:h-[32rem]" />}
      {/* Blitz and Eternum stack from the top of their column, whatever Frontier's height beside them. */}
      <div className="flex flex-col gap-3 lg:gap-4">
        <BlitzLobbyCard games={games} now={now} />
        <EternumCard games={games} now={now} className="h-32 lg:h-40" />
      </div>
    </div>
  );
};

export const PlayPage = () => (
  <PageFrame back="/">
    <PlayBody />
  </PageFrame>
);
