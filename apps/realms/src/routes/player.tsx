import { Effect } from "effect";
import { useParams } from "@tanstack/react-router";

import { HeraldClient } from "@/services/herald";
import { IdentityApi } from "@/services/identity";
import { MmrClient, mmrTier, mmrToInteger } from "@/services/mmr";
import { portraitUrl, shortAddress } from "@/ui/format";
import { useQuery } from "@/ui/hooks";
import { ErrorPanel, Loading, Panel, PanelTitle } from "@/ui/kit";
import { matchHistory } from "@/ui/match-history";
import { MatchList } from "@/ui/match-list";

/** Public profile: name and portrait from identity, rating live, history composed. */
export function PlayerScreen() {
  const { address } = useParams({ from: "/p/$address" });

  const header = useQuery(
    () =>
      Effect.gen(function* () {
        const identity = yield* IdentityApi;
        const mmr = yield* MmrClient;
        const population = yield* identity.leaderboardPopulation;
        const player = population.find((row) => row.address.toLowerCase() === address.toLowerCase());
        const rating = yield* mmr.rating(address);
        return { player: player ?? null, rating };
      }),
    [address],
  );

  const directory = useQuery(() => Effect.flatMap(HeraldClient, (herald) => herald.directory), []);
  const history = useQuery(
    () => (directory.kind === "ok" ? matchHistory(address, directory.value.games, 12) : Effect.succeed([])),
    [address, directory.kind],
  );

  return (
    <div className="grid max-w-[880px] items-start gap-3.5 lg:grid-cols-[300px_1fr]">
      <Panel>
        <PanelTitle>Lord</PanelTitle>
        {header.kind === "loading" && <Loading />}
        {header.kind === "error" && <ErrorPanel error={header.error} retry={header.refresh} />}
        {header.kind === "ok" && (
          <div className="flex items-start gap-3.5">
            <img
              src={portraitUrl(header.value.player?.portrait ?? null)}
              alt=""
              className="cut h-16 w-16 border border-amber-deep object-cover"
            />
            <div>
              <div className="font-display text-[22px] tracking-[0.05em]">
                {header.value.player?.name ?? shortAddress(address)}
              </div>
              {(() => {
                const mmr = mmrToInteger(header.value.rating);
                const tier = mmrTier(mmr);
                return (
                  <div
                    className={`mt-1 font-heading text-[12px] font-semibold uppercase tracking-[0.1em] ${tier.color}`}
                  >
                    {tier.name} · <span className="font-mono tabular-nums">{mmr.toLocaleString("en-US")}</span>
                  </div>
                );
              })()}
              {header.value.player && (
                <div className="mt-1 font-mono text-[11px] text-faint">{header.value.player.games} rated games</div>
              )}
            </div>
          </div>
        )}
      </Panel>
      <Panel>
        <PanelTitle>Match history</PanelTitle>
        {(directory.kind === "loading" || history.kind === "loading") && <Loading />}
        {directory.kind === "error" && <ErrorPanel error={directory.error} retry={directory.refresh} />}
        {history.kind === "error" && <ErrorPanel error={history.error} retry={history.refresh} />}
        {history.kind === "ok" && directory.kind === "ok" && (
          <MatchList rows={history.value} empty="No finished games on record." />
        )}
      </Panel>
    </div>
  );
}
