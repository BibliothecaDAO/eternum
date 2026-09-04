import { Effect } from "effect";
import { Link } from "@tanstack/react-router";

import { IdentityApi } from "@/services/identity";
import { MmrClient, mmrTier, mmrToInteger } from "@/services/mmr";
import { normalizeStarknetAddress } from "@realms-world/identity";
import { portraitUrl, shortAddress } from "@/ui/format";
import { useQuery } from "@/ui/hooks";
import { ErrorPanel, Loading, Panel, PanelTitle } from "@/ui/kit";
import { useSession } from "@/ui/session";

interface LadderRow {
  readonly address: string;
  readonly name: string | null;
  readonly portrait: string | null;
  readonly games: number;
  readonly mmr: number;
}

/**
 * Population and game counts come from the indexed MMRUpdated history; the
 * rating shown is a live read of the MMR token, which stays the one truth.
 */
const ladder = Effect.gen(function* () {
  const identity = yield* IdentityApi;
  const mmr = yield* MmrClient;
  const population = yield* identity.leaderboardPopulation;
  const ratings = yield* mmr.ratings(population.map((player) => player.address));
  return population
    .map(
      (player): LadderRow => ({
        ...player,
        mmr: mmrToInteger(ratings.get(player.address) ?? 0n),
      }),
    )
    .sort((a, b) => b.mmr - a.mmr);
});

export function RanksScreen() {
  const { session } = useSession();
  const query = useQuery(() => ladder, []);
  const self = session ? normalizeStarknetAddress(session.address) : null;

  return (
    <Panel className="max-w-[880px]">
      <PanelTitle>Season ladder</PanelTitle>
      {query.kind === "loading" && <Loading label="Reading the ladder…" />}
      {query.kind === "error" && <ErrorPanel error={query.error} retry={query.refresh} />}
      {query.kind === "ok" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["#", "Lord", "Tier", "Rating", "Games"].map((header) => (
                  <th
                    key={header}
                    className="border-b border-line pb-1.5 pr-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-faint"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.value.map((row, index) => {
                const tier = mmrTier(row.mmr);
                const isSelf = self !== null && normalizeStarknetAddress(row.address) === self;
                return (
                  <tr key={row.address} className={isSelf ? "bg-[#f6ac1d0d]" : undefined}>
                    <td className="border-b border-line-soft py-2 pr-3 font-mono tabular-nums">{index + 1}</td>
                    <td className="border-b border-line-soft py-2 pr-3">
                      <Link
                        to="/p/$address"
                        params={{ address: row.address }}
                        className="flex items-center gap-2.5 font-semibold hover:text-amber-hot"
                      >
                        <img
                          src={portraitUrl(row.portrait)}
                          alt=""
                          className="cut-sm h-7 w-7 border border-line object-cover"
                        />
                        {row.name ?? shortAddress(row.address)}
                        {isSelf && <span className="text-[10px] text-amber-hot">YOU</span>}
                      </Link>
                    </td>
                    <td
                      className={`border-b border-line-soft py-2 pr-3 font-heading text-[11px] font-semibold uppercase tracking-[0.1em] ${tier.color}`}
                    >
                      {tier.name}
                    </td>
                    <td className="border-b border-line-soft py-2 pr-3 font-mono tabular-nums">
                      {row.mmr.toLocaleString("en-US")}
                    </td>
                    <td className="border-b border-line-soft py-2 pr-3 font-mono tabular-nums">{row.games}</td>
                  </tr>
                );
              })}
              {query.value.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-muted">
                    No rated lords yet — the ladder fills as games settle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
