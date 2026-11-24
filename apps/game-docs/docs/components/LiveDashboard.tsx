import { useCallback, useEffect, useState } from "react";
import { GameIcon } from "./GameIcon";
import type { HeraldGameDirectoryEntry } from "../../../../packages/core/src/sync/herald-http-types";
import {
  DASHBOARD_CONFIG,
  formatUtcStamp,
  loadDashboardData,
  loadDirectory,
  pickDefaultGame,
  readCachedDashboard,
  writeCachedDashboard,
  type ChartPoint,
  type DashboardSnapshot,
} from "../utils/dashboard-data";

const n = (value: number | bigint) => value.toLocaleString("en-US");
const formatMaybe = (value: number | null) => (value === null ? "—" : n(value));
const formatBig = (value: string) => n(BigInt(value || "0"));

function BarChart({
  title,
  points,
  color,
  emptyLabel,
}: {
  title: string;
  points: readonly ChartPoint[];
  color: string;
  emptyLabel: string;
}) {
  const recent = points.slice(-7);
  if (recent.length === 0) {
    return (
      <div className="docs-dash-card">
        <h3>{title}</h3>
        <div className="docs-dash-empty">{emptyLabel}</div>
      </div>
    );
  }
  const maxValue = Math.max(1, ...recent.map((point) => point.value));
  const midValue = Math.round(maxValue / 2);
  const width = 360;
  const chartLeft = 40;
  const chartRight = 348;
  const chartBottom = 152;
  const chartTop = 28;
  const chartHeight = chartBottom - chartTop;
  const slotWidth = (chartRight - chartLeft) / recent.length;
  const barWidth = Math.min(44, Math.max(18, Math.floor(slotWidth * 0.6)));

  return (
    <div className="docs-dash-card">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${width} 190`} role="img" aria-label={title}>
        <line x1={chartLeft} x2={chartRight} y1={chartBottom} y2={chartBottom} stroke="var(--line)" />
        <line
          x1={chartLeft}
          x2={chartRight}
          y1={chartTop + chartHeight / 2}
          y2={chartTop + chartHeight / 2}
          stroke="var(--line)"
          strokeDasharray="3 3"
        />
        <line x1={chartLeft} x2={chartRight} y1={chartTop} y2={chartTop} stroke="var(--line)" strokeDasharray="3 3" />
        <text x={chartLeft - 6} y={chartBottom + 4} textAnchor="end">
          0
        </text>
        <text x={chartLeft - 6} y={chartTop + chartHeight / 2 + 4} textAnchor="end">
          {n(midValue)}
        </text>
        <text x={chartLeft - 6} y={chartTop + 4} textAnchor="end">
          {n(maxValue)}
        </text>
        {recent.map((point, index) => {
          const height = Math.max(2, Math.round((point.value / maxValue) * chartHeight));
          const x = Math.round(chartLeft + index * slotWidth + (slotWidth - barWidth) / 2);
          const y = chartBottom - height;
          const center = x + barWidth / 2;
          return (
            <g key={point.key}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx={4}
                fill={color}
                opacity={index === recent.length - 1 ? 0.8 : 1}
              />
              <text className="docs-dash-svg-val" x={center} y={Math.max(14, y - 6)} textAnchor="middle">
                {n(point.value)}
              </text>
              <text x={center} y={172} textAnchor="middle">
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const initialStandings = DASHBOARD_CONFIG.aspects.map((aspect) => ({
  id: aspect.id,
  name: aspect.name,
  icon: aspect.icon,
  color: aspect.color,
  height: 0,
  finishHeight: 0,
  members: 0,
  gloryTotal: null as string | null,
}));

export function LiveDashboard() {
  const [games, setGames] = useState<HeraldGameDirectoryEntry[]>([]);
  const [confirmedBlock, setConfirmedBlock] = useState<number>(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadForGame = useCallback(async (game: HeraldGameDirectoryEntry, headBlock: number, bypassCache: boolean) => {
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    if (!bypassCache) {
      const cached = readCachedDashboard(storage, game.game_id);
      if (cached) {
        setSnapshot(cached);
        setError(null);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const fresh = await loadDashboardData(game, headBlock);
      writeCachedDashboard(storage, game.game_id, fresh);
      setSnapshot(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const directory = await loadDirectory();
        if (cancelled) return;
        setGames(directory.games);
        setConfirmedBlock(directory.confirmed_block);
        const chosen = pickDefaultGame(directory.games);
        if (!chosen) {
          setLoading(false);
          return;
        }
        setSelectedId(chosen.game_id);
        await loadForGame(chosen, directory.confirmed_block, false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not reach Herald");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadForGame]);

  const activeGame = games.find((entry) => entry.game_id === selectedId) ?? null;

  const handleSelectGame = (nextId: number) => {
    setSelectedId(nextId);
    const chosen = games.find((entry) => entry.game_id === nextId);
    if (chosen) void loadForGame(chosen, confirmedBlock, false);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const directory = await loadDirectory();
      setGames(directory.games);
      setConfirmedBlock(directory.confirmed_block);
      const chosen = directory.games.find((entry) => entry.game_id === selectedId) ?? pickDefaultGame(directory.games);
      if (chosen) {
        setSelectedId(chosen.game_id);
        await loadForGame(chosen, directory.confirmed_block, true);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh data");
      setLoading(false);
    }
  };

  const standings = snapshot?.aspectStandings ?? initialStandings;
  const gameStatusLabel = snapshot
    ? snapshot.dayIndex !== null && snapshot.seasonDays !== null
      ? `${snapshot.status} · Day ${snapshot.dayIndex + 1} / ${snapshot.seasonDays}`
      : snapshot.status
    : "Loading";

  return (
    <div className="docs-dash">
      <div className="docs-dash-bar">
        <label>
          <span>Game</span>
          <select
            aria-label="Game"
            value={selectedId ?? ""}
            onChange={(event) => handleSelectGame(Number(event.target.value))}
            disabled={games.length === 0 || loading}
          >
            {games.length === 0 ? (
              <option value="">Loading games…</option>
            ) : (
              games.map((entry) => (
                <option key={entry.game_id} value={entry.game_id}>
                  {entry.name} ({entry.status})
                </option>
              ))
            )}
          </select>
        </label>
        <button type="button" onClick={() => void handleRefresh()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh now"}
        </button>
        <span className="docs-dash-stamp">
          Cached {DASHBOARD_CONFIG.cacheHours}h
          {snapshot ? (
            <>
              {" · "}Updated <strong>{formatUtcStamp(snapshot.fetchedAt)}</strong>
              {" · "}Block <strong>{n(snapshot.confirmedBlock)}</strong>
            </>
          ) : null}
        </span>
      </div>

      {error ? <p className="docs-dash-error">{error}</p> : null}
      {snapshot && !snapshot.complete ? (
        <p className="docs-dash-error">
          Some live endpoints did not respond; missing counts show — and were not cached.
        </p>
      ) : null}

      <section className="docs-dash-tiles" aria-label="Summary counters">
        <article className="docs-dash-tile">
          <div className="docs-dash-label">Players and realms</div>
          <div className="docs-dash-fig">{snapshot ? n(snapshot.realms) : "—"}</div>
          <ul>
            <li>
              <span>Enrolled players</span>
              <span>{snapshot ? n(snapshot.players) : "—"}</span>
            </li>
            <li>
              <span>Signed-in accounts</span>
              <span>{snapshot ? formatMaybe(snapshot.signedInAccounts) : "—"}</span>
            </li>
            <li>
              <span>Ancient Seals</span>
              <span>{snapshot ? formatMaybe(snapshot.seals) : "—"}</span>
            </li>
            <li>
              <span>Active today</span>
              <span>{snapshot ? formatMaybe(snapshot.activeToday) : "—"}</span>
            </li>
          </ul>
        </article>

        <article className="docs-dash-tile">
          <div className="docs-dash-label">Player actions</div>
          <div className="docs-dash-fig">{snapshot ? formatMaybe(snapshot.playerActionsTotal) : "—"}</div>
          <ul>
            <li>
              <span>Tiles explored</span>
              <span>{snapshot ? formatMaybe(snapshot.tilesExplored) : "—"}</span>
            </li>
            <li>
              <span>Battles</span>
              <span>{snapshot ? formatMaybe(snapshot.battles) : "—"}</span>
            </li>
            <li>
              <span>Realms created</span>
              <span>{snapshot ? formatMaybe(snapshot.realmsCreatedTotal) : "—"}</span>
            </li>
          </ul>
        </article>

        <article className="docs-dash-tile">
          <div className="docs-dash-label">Live armies</div>
          <div className="docs-dash-fig">{snapshot ? formatMaybe(snapshot.totalArmies) : "—"}</div>
          <ul>
            <li>
              <span>On expedition</span>
              <span>{snapshot ? formatMaybe(snapshot.expeditionArmies) : "—"}</span>
            </li>
            <li>
              <span>In the Deep</span>
              <span>{snapshot ? formatMaybe(snapshot.deepArmies) : "—"}</span>
            </li>
            <li>
              <span>Deep sites</span>
              <span>{snapshot ? formatMaybe(snapshot.deepSites) : "—"}</span>
            </li>
          </ul>
        </article>

        <article className="docs-dash-tile">
          <div className="docs-dash-label">Shard head</div>
          <div className="docs-dash-fig">{snapshot ? n(snapshot.latestBlock ?? snapshot.confirmedBlock) : "—"}</div>
          <ul>
            <li>
              <span>Latest block txs</span>
              <span>{snapshot ? formatMaybe(snapshot.latestBlockTxs) : "—"}</span>
            </li>
            <li>
              <span>Game status</span>
              <span>{gameStatusLabel}</span>
            </li>
            <li>
              <span>World Banes today</span>
              <span>{snapshot ? formatMaybe(snapshot.activeWorldBanes) : "—"}</span>
            </li>
          </ul>
        </article>
      </section>

      <h2>Aspect race and hyperstructures</h2>
      <div className="docs-dash-race">
        {standings.map((row) => {
          const percent = Math.min(100, row.finishHeight > 0 ? (row.height / row.finishHeight) * 100 : 0);
          return (
            <div className="docs-dash-aspect" key={row.id}>
              <div className="docs-dash-aspect-top">
                <span className="docs-dash-aspect-name">
                  <GameIcon name={row.icon} size={22} />
                  {row.name}
                </span>
                <span className="docs-dash-aspect-meta">
                  <strong>{snapshot ? n(row.height) : "—"}</strong>
                  {row.finishHeight > 0 ? ` / ${n(row.finishHeight)} height` : " height"} ·{" "}
                  {snapshot ? n(row.members) : "—"} members ·{" "}
                  <strong>{snapshot && row.gloryTotal !== null ? formatBig(row.gloryTotal) : "—"}</strong> Glory
                </span>
              </div>
              <div className="docs-dash-track">
                <div className="docs-dash-fill" style={{ width: `${percent}%`, background: row.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <h2>Daily activity and growth</h2>
      <div className="docs-dash-charts">
        <BarChart
          title="Active players per Frontier day"
          points={snapshot?.activityByDay ?? []}
          color="var(--gold)"
          emptyLabel={
            snapshot && snapshot.activityByDay === null
              ? "Could not load daily activity."
              : "No active Frontier days recorded yet."
          }
        />
        <BarChart
          title="Realms created per UTC day"
          points={snapshot?.realmsByUtcDay ?? []}
          color="var(--sage)"
          emptyLabel={
            snapshot && snapshot.realmsByUtcDay === null ? "Could not load realm history." : "No realms created yet."
          }
        />
        <BarChart
          title="Player actions per UTC day"
          points={snapshot?.actionsByUtcDay ?? []}
          color="var(--gold2)"
          emptyLabel={
            snapshot && snapshot.actionsByUtcDay === null
              ? "Could not load daily player actions."
              : "Daily player action rollups appear once actions are recorded."
          }
        />
      </div>

      <h2>Top Glory earners by Aspect</h2>
      <div className="docs-dash-scroll">
        <table>
          <thead>
            <tr>
              <th>Aspect</th>
              <th>Rank</th>
              <th>Player</th>
              <th>Realm</th>
              <th>Glory</th>
            </tr>
          </thead>
          <tbody>
            {snapshot && snapshot.topGlory && snapshot.topGlory.length > 0 ? (
              snapshot.topGlory.map((row) => (
                <tr key={`${row.aspectId}-${row.owner}-${row.realmId}`}>
                  <td>
                    <GameIcon name={row.aspectIcon} size={20} />
                    {row.aspectName}
                  </td>
                  <td>#{row.rank}</td>
                  <td>{row.displayName}</td>
                  <td>#{row.realmId}</td>
                  <td>{formatBig(row.glory)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  {snapshot && snapshot.topGlory === null
                    ? "Could not load Aspect rosters."
                    : activeGame
                      ? "No ranked Aspect members yet."
                      : "Loading rosters…"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
