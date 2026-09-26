import { useIdentitySession } from "@/hooks/context/identity-session";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { isGameOver } from "@/runtime/world/directory";

import { entryHref } from "./game-links";
import { type DirectoryGame, useDirectory } from "./herald";
import { ErrorPanel, Loading } from "./kit";
import { PrimaryLink } from "./live-chips";
import { HERO_ART } from "./mode-art";
import { BlitzCard, EternumCard, FrontierCard } from "./mode-cards";
import { RealmCard, seasonRealm } from "./realm-card";
import { SeasonPodium } from "./season-podium";
import { useNowSeconds } from "./use-now";

/**
 * Home, the Play tab (design o1, o2, o10). A first visit meets the painted hero with one Play free into the live
 * season; a player with a realm meets their realm card and Resume. Below, the modes as live cards and the season's
 * podium. On desktop the painting is the page and the modes stand in a row beneath it.
 */
export const HomePage = () => {
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
  // The player's own season first, where their realm stands; else the first live one.
  const seasons = games.filter((game) => game.mode === "frontier" && !isGameOver(game));
  const season = (status === "signed-in" ? seasons.find((game) => seasonRealm(game)) : undefined) ?? seasons[0];
  const realm = status === "signed-in" && season ? seasonRealm(season) : undefined;

  return (
    // Isolated, so the paintings behind the page stay above the shell's own background.
    <div className="relative isolate flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,34rem)_1fr_minmax(0,24rem)] lg:items-start lg:gap-x-3 lg:gap-y-20 lg:pt-24">
      <HeroBackdrop />
      <div className="lg:col-start-1 lg:row-start-1">
        {realm && season ? <RealmCard season={season} /> : <Pitch season={season} />}
      </div>
      {season && (
        <SeasonPodium
          season={season}
          className={cn("order-last lg:order-none lg:col-start-3 lg:row-start-1", realm && "hidden lg:flex")}
        />
      )}
      <div
        className={cn("grid gap-3 lg:col-span-3 lg:row-start-2 lg:grid-cols-3", realm ? "grid-cols-1" : "grid-cols-2")}
      >
        {season && <FrontierCard season={season} className="hidden h-64 lg:block" />}
        <BlitzCard games={games} now={now} className={realm ? "h-28 lg:h-64" : "h-32 lg:h-64"} />
        <EternumCard games={games} now={now} className={realm ? "h-24 lg:h-64" : "h-32 lg:h-64"} />
      </div>
    </div>
  );
};

/** The painting behind the page on desktop; on a phone the pitch carries its own. */
const HeroBackdrop = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute left-1/2 top-[-4.5rem] -z-10 hidden h-[44rem] w-screen -translate-x-1/2 lg:block"
  >
    <img src={HERO_ART} alt="" className="size-full object-cover object-[50%_30%]" />
    <span className="absolute inset-0 bg-gradient-to-b from-[#0c0a08]/20 via-[#0c0a08]/40 to-[#0c0a08]" />
  </div>
);

/** The first visit's pitch: the headline, one line, and Play free into the live season. */
const Pitch = ({ season }: { season: DirectoryGame | undefined }) => (
  <section className="relative isolate -mx-3 -mt-[4.5rem] flex min-h-[27rem] flex-col justify-end gap-3 overflow-hidden px-4 pb-5 lg:mx-0 lg:mt-0 lg:min-h-0 lg:p-0">
    <img src={HERO_ART} alt="" className="absolute inset-0 -z-10 size-full object-cover object-[50%_20%] lg:hidden" />
    <span className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[#0c0a08]/30 to-[#0c0a08] lg:hidden" />
    <h1 className="font-[Lexend] text-[34px] font-extrabold leading-[1.1] text-[#fff3c4] drop-shadow-[0_3px_0_#1b1207] lg:text-[52px]">
      Found a realm. Explore the Mist.
    </h1>
    <p className="text-[17px] text-[#eadfc8] lg:text-[19px]">A new map every day. Your realm keeps what it earns.</p>
    <div className="lg:w-80">
      <PrimaryLink to={season ? entryHref(season, "play") : "/play"}>Play free</PrimaryLink>
    </div>
  </section>
);
