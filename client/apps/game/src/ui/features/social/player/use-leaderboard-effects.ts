import { useCallback, useEffect, useRef, useState } from "react";

export type EffectIntensity = "small" | "medium" | "large";

export interface PointDeltas {
  tilesExploredPoints: number;
  cratesOpenedPoints: number;
  riftsTakenPoints: number;
  hyperstructuresTakenPoints: number;
  hyperstructuresHeldPoints: number;
  totalPoints: number;
}

export interface PlayerEffect {
  address: string;
  pointDeltas: PointDeltas;
  rankChange: number; // negative = moved up (improved), positive = moved down (worsened)
  previousRank: number;
  newRank: number;
  timestamp: number;
  pointIntensity: EffectIntensity;
  rankIntensity: EffectIntensity;
}

interface PlayerSnapshot {
  tilesExploredPoints: number;
  cratesOpenedPoints: number;
  riftsTakenPoints: number;
  hyperstructuresTakenPoints: number;
  hyperstructuresHeldPoints: number;
  totalPoints: number;
  rank: number;
}

interface PlayerWithStats {
  address: bigint;
  leaderboardRank: number;
  leaderboardPoints: number;
  tilesExploredPoints: number;
  cratesOpenedPoints: number;
  riftsTakenPoints: number;
  hyperstructuresTakenPoints: number;
  hyperstructuresHeldPoints: number;
}

const EFFECT_DURATION_MS = 2500;
const MOCKUP_INTERVAL_MS = 4000;

const createEmptyDeltas = (): PointDeltas => ({
  tilesExploredPoints: 0,
  cratesOpenedPoints: 0,
  riftsTakenPoints: 0,
  hyperstructuresTakenPoints: 0,
  hyperstructuresHeldPoints: 0,
  totalPoints: 0,
});

const normalizeAddress = (address: bigint): string => String(address).toLowerCase();

const getPointIntensity = (delta: number): EffectIntensity => {
  if (delta >= 500) return "large";
  if (delta >= 100) return "medium";
  return "small";
};

const getRankIntensity = (change: number): EffectIntensity => {
  const abs = Math.abs(change);
  if (abs >= 5) return "large";
  if (abs >= 3) return "medium";
  return "small";
};

export const useLeaderboardEffects = (
  players: PlayerWithStats[],
  mockupMode: boolean = false,
): {
  effects: Map<string, PlayerEffect>;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
} => {
  const previousSnapshotsRef = useRef<Map<string, PlayerSnapshot>>(new Map());
  const [effects, setEffects] = useState<Map<string, PlayerEffect>>(() => new Map());
  const mockupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isInitializedRef = useRef(false);

  // Detect changes and trigger effects (real mode only)
  useEffect(() => {
    if (mockupMode) {
      return;
    }

    // Build current snapshots
    const currentSnapshots = new Map<string, PlayerSnapshot>();
    for (const player of players) {
      const address = normalizeAddress(player.address);
      currentSnapshots.set(address, {
        tilesExploredPoints: player.tilesExploredPoints,
        cratesOpenedPoints: player.cratesOpenedPoints,
        riftsTakenPoints: player.riftsTakenPoints,
        hyperstructuresTakenPoints: player.hyperstructuresTakenPoints,
        hyperstructuresHeldPoints: player.hyperstructuresHeldPoints,
        totalPoints: player.leaderboardPoints,
        rank: player.leaderboardRank,
      });
    }

    // On first run, just store the baseline - no effects
    if (!isInitializedRef.current) {
      previousSnapshotsRef.current = currentSnapshots;
      isInitializedRef.current = true;
      return;
    }

    const previousSnapshots = previousSnapshotsRef.current;
    const newEffects = new Map<string, PlayerEffect>();

    for (const player of players) {
      const address = normalizeAddress(player.address);
      const currentSnapshot = currentSnapshots.get(address)!;
      const previousSnapshot = previousSnapshots.get(address);

      if (!previousSnapshot) {
        continue;
      }

      const deltas: PointDeltas = {
        tilesExploredPoints: Math.max(0, currentSnapshot.tilesExploredPoints - previousSnapshot.tilesExploredPoints),
        cratesOpenedPoints: Math.max(0, currentSnapshot.cratesOpenedPoints - previousSnapshot.cratesOpenedPoints),
        riftsTakenPoints: Math.max(0, currentSnapshot.riftsTakenPoints - previousSnapshot.riftsTakenPoints),
        hyperstructuresTakenPoints: Math.max(
          0,
          currentSnapshot.hyperstructuresTakenPoints - previousSnapshot.hyperstructuresTakenPoints,
        ),
        hyperstructuresHeldPoints: Math.max(
          0,
          currentSnapshot.hyperstructuresHeldPoints - previousSnapshot.hyperstructuresHeldPoints,
        ),
        totalPoints: Math.max(0, currentSnapshot.totalPoints - previousSnapshot.totalPoints),
      };

      const rankChange = currentSnapshot.rank - previousSnapshot.rank;

      const hasPointDelta = Object.values(deltas).some((v) => v > 0);
      const hasRankChange = rankChange !== 0 && previousSnapshot.rank !== Number.MAX_SAFE_INTEGER;

      if (hasPointDelta || hasRankChange) {
        newEffects.set(address, {
          address,
          pointDeltas: deltas,
          rankChange,
          previousRank: previousSnapshot.rank,
          newRank: currentSnapshot.rank,
          timestamp: Date.now(),
          pointIntensity: getPointIntensity(deltas.totalPoints),
          rankIntensity: getRankIntensity(rankChange),
        });
      }
    }

    // Update snapshots for next comparison
    previousSnapshotsRef.current = currentSnapshots;

    // If we have effects, show them then clear after duration
    if (newEffects.size > 0) {
      setEffects(newEffects);

      const timer = setTimeout(() => {
        setEffects(new Map());
      }, EFFECT_DURATION_MS);

      return () => clearTimeout(timer);
    }
  }, [players, mockupMode]);

  // Mockup mode: generate fake effects periodically
  const generateMockupEffects = useCallback(() => {
    if (players.length === 0) {
      return;
    }

    const newEffects = new Map<string, PlayerEffect>();

    // Select 2-4 random players
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const selectedCount = Math.min(shuffled.length, 2 + Math.floor(Math.random() * 3));
    const selectedPlayers = shuffled.slice(0, selectedCount);

    for (const player of selectedPlayers) {
      const address = normalizeAddress(player.address);
      const deltas = createEmptyDeltas();

      // Randomly populate 1-3 categories with point gains
      const categories = [
        "tilesExploredPoints",
        "cratesOpenedPoints",
        "riftsTakenPoints",
        "hyperstructuresTakenPoints",
        "hyperstructuresHeldPoints",
      ] as const;

      const numCategories = 1 + Math.floor(Math.random() * 3);
      const shuffledCategories = [...categories].sort(() => Math.random() - 0.5);

      let totalGain = 0;
      for (let i = 0; i < numCategories; i++) {
        const category = shuffledCategories[i];
        // Vary gains more to show different intensities
        const intensityRoll = Math.random();
        let gain: number;
        if (intensityRoll > 0.85) {
          gain = 500 + Math.floor(Math.random() * 500); // large
        } else if (intensityRoll > 0.5) {
          gain = 100 + Math.floor(Math.random() * 300); // medium
        } else {
          gain = 10 + Math.floor(Math.random() * 80); // small
        }
        deltas[category] = gain;
        totalGain += gain;
      }
      deltas.totalPoints = totalGain;

      // Random rank change (-5 to +5, weighted towards smaller changes)
      const rankChangeOptions = [-5, -4, -3, -3, -2, -2, -2, -1, -1, -1, -1, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5];
      const rankChange = rankChangeOptions[Math.floor(Math.random() * rankChangeOptions.length)];

      newEffects.set(address, {
        address,
        pointDeltas: deltas,
        rankChange,
        previousRank: player.leaderboardRank + rankChange,
        newRank: player.leaderboardRank,
        timestamp: Date.now(),
        pointIntensity: getPointIntensity(totalGain),
        rankIntensity: getRankIntensity(rankChange),
      });
    }

    setEffects(newEffects);

    // Clear after animation duration
    setTimeout(() => {
      setEffects(new Map());
    }, EFFECT_DURATION_MS);
  }, [players]);

  // Setup mockup interval
  useEffect(() => {
    if (mockupMode) {
      // Generate initial effects immediately
      generateMockupEffects();

      // Then generate periodically
      mockupIntervalRef.current = setInterval(generateMockupEffects, MOCKUP_INTERVAL_MS);

      return () => {
        if (mockupIntervalRef.current) {
          clearInterval(mockupIntervalRef.current);
          mockupIntervalRef.current = null;
        }
      };
    } else {
      if (mockupIntervalRef.current) {
        clearInterval(mockupIntervalRef.current);
        mockupIntervalRef.current = null;
      }
    }
  }, [mockupMode, generateMockupEffects]);

  return { effects, rowRefs };
};
