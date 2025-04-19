import { ETERNUM_CONFIG } from "@/utils/config";
import { ResourcesIds } from "@bibliothecadao/types";

// Common styles shared with other components
const styles = {
  sectionStyle: {
    marginBottom: "2rem",
  },
  subtitleStyle: {
    fontWeight: "bold",
    fontSize: "0.9rem",
    color: "#f0b060",
    marginBottom: "0.75rem",
    marginTop: "1.5rem",
  },
  title: {
    fontWeight: "bold",
    fontSize: "1.1rem",
    color: "#f0b060",
    marginBottom: "1.25rem",
  },
  troopsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    gap: "1rem",
    "@media (min-width: 768px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
  },
  troopCard: {
    padding: "1rem",
    borderRadius: "0.5rem",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    borderBottom: "1px solid #4d3923",
    borderLeft: "1px solid #4d3923",
  },
  troopHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "1rem",
    color: "#dfc296",
    fontWeight: 600,
    fontSize: "1rem",
    paddingBottom: "0.5rem",
    borderBottom: "1px solid #6d4923",
  },
  sectionHeader: {
    fontWeight: "bold",
    color: "#f0b060",
    marginBottom: "0.5rem",
    fontSize: "0.85rem",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "0.5rem",
    marginBottom: "1rem",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "#f9fafb",
  },
  statValue: {
    color: "#dfc296",
    fontSize: "0.85rem",
  },
  divider: {
    margin: "1rem 0",
    borderTop: "1px solid #6d4923",
  },
  fullWidthHeader: {
    gridColumn: "1 / -1",
    fontWeight: 600,
    color: "#e5c687",
    fontSize: "0.8rem",
  },
};

export default function TroopsTable() {
  const troopTypes = [ResourcesIds.Paladin, ResourcesIds.Knight, ResourcesIds.Crossbowman];

  const config = ETERNUM_CONFIG();

  const getTroopName = (troopId: number) => {
    switch (troopId) {
      case ResourcesIds.Paladin:
        return "Paladin";
      case ResourcesIds.Knight:
        return "Knight";
      case ResourcesIds.Crossbowman:
        return "Crossbowman";
      default:
        return "Unknown";
    }
  };

  // Function to get troop icon/emoji
  const getTroopIcon = (troopId: number) => {
    switch (troopId) {
      case ResourcesIds.Paladin:
        return "🛡️";
      case ResourcesIds.Knight:
        return "⚔️";
      case ResourcesIds.Crossbowman:
        return "🏹";
      default:
        return "👤";
    }
  };

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.title}>Military Units</div>

      <div style={styles.troopsGrid}>
        {troopTypes.map((troopId) => {
          const troopName = getTroopName(troopId);
          const troopIcon = getTroopIcon(troopId);
          const maxStamina = config.troop.stamina[`stamina${troopName}Max`];

          return (
            <div key={troopId} style={styles.troopCard}>
              <div style={styles.troopHeader}>
                {troopIcon} {troopName}
              </div>

              <div>
                <div style={styles.sectionHeader}>⚡️ Stamina</div>
                <div style={styles.statsGrid}>
                  <div>
                    <span style={styles.statLabel}>Initial: </span>
                    <span style={styles.statValue}>{config.troop.stamina.staminaInitial}</span>
                  </div>
                  <div>
                    <span style={styles.statLabel}>Max: </span>
                    <span style={styles.statValue}>{maxStamina}</span>
                  </div>
                  <div>
                    <span style={styles.statLabel}>Gain Per Tick: </span>
                    <span style={styles.statValue}>{config.troop.stamina.staminaGainPerTick}</span>
                  </div>
                  <div>
                    <span style={styles.statLabel}>Biome Bonus: </span>
                    <span style={styles.statValue}>{config.troop.stamina.staminaBonusValue}</span>
                  </div>
                </div>
              </div>

              <div>
                <div style={styles.sectionHeader}>📊 Stamina Costs</div>
                <div style={styles.statsGrid}>
                  <div>
                    <span style={styles.statLabel}>Travel: </span>
                    <span style={styles.statValue}>{config.troop.stamina.staminaTravelStaminaCost}</span>
                  </div>
                  <div>
                    <span style={styles.statLabel}>Explore: </span>
                    <span style={styles.statValue}>{config.troop.stamina.staminaExploreStaminaCost}</span>
                  </div>
                  <div>
                    <span style={styles.statLabel}>Attack Min: </span>
                    <span style={styles.statValue}>{config.troop.stamina.staminaAttackReq}</span>
                  </div>
                  <div>
                    <span style={styles.statLabel}>Attack Max: </span>
                    <span style={styles.statValue}>{config.troop.stamina.staminaAttackMax}</span>
                  </div>
                </div>
              </div>

              {troopId === ResourcesIds.Paladin && (
                <>
                  <div>
                    <div style={styles.sectionHeader}>🍲 Food Consumption</div>
                    <div style={styles.statsGrid}>
                      <div style={styles.fullWidthHeader}>Travel:</div>
                      <div>
                        <span style={styles.statLabel}>Wheat: </span>
                        <span style={styles.statValue}>{config.troop.stamina.staminaTravelWheatCost}</span>
                      </div>
                      <div>
                        <span style={styles.statLabel}>Fish: </span>
                        <span style={styles.statValue}>{config.troop.stamina.staminaTravelFishCost}</span>
                      </div>

                      <div style={styles.fullWidthHeader}>Explore:</div>
                      <div>
                        <span style={styles.statLabel}>Wheat: </span>
                        <span style={styles.statValue}>{config.troop.stamina.staminaExploreWheatCost}</span>
                      </div>
                      <div>
                        <span style={styles.statLabel}>Fish: </span>
                        <span style={styles.statValue}>{config.troop.stamina.staminaExploreFishCost}</span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.divider}></div>

                  <div>
                    <div style={styles.sectionHeader}>🔣 Troop Limits</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem" }}>
                      <div>
                        <span style={styles.statLabel}>Max Explorer Party: </span>
                        <span style={styles.statValue}>{config.troop.limit.explorerMaxPartyCount}</span>
                      </div>
                      <div>
                        <span style={styles.statLabel}>Max Troop Count: </span>
                        <span style={styles.statValue}>{config.troop.limit.explorerAndGuardMaxTroopCount}</span>
                      </div>
                      <div>
                        <span style={styles.statLabel}>Guard Resurrection: </span>
                        <span style={styles.statValue}>
                          {Math.floor(config.troop.limit.guardResurrectionDelay / 3600)} hours
                        </span>
                      </div>
                      <div>
                        <span style={styles.statLabel}>Mercenary Range: </span>
                        <span style={styles.statValue}>
                          {config.troop.limit.mercenariesTroopLowerBound} -{" "}
                          {config.troop.limit.mercenariesTroopUpperBound}
                        </span>
                      </div>
                      <div>
                        <span style={styles.statLabel}>Agent Range: </span>
                        <span style={styles.statValue}>
                          {config.troop.limit.agentTroopLowerBound} - {config.troop.limit.agentTroopUpperBound}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {troopId === ResourcesIds.Knight && (
                <>
                  <div style={styles.divider}></div>
                  <div>
                    <div style={styles.sectionHeader}>⚔️ Damage Multipliers</div>
                    <div style={styles.statsGrid}>
                      <div>
                        <span style={styles.statLabel}>T1 Base: </span>
                        <span style={styles.statValue}>1.0</span>
                      </div>
                      <div>
                        <span style={styles.statLabel}>T2: </span>
                        <span style={styles.statValue}>
                          {Number(config.troop.damage.t2DamageMultiplier) / 1844674407370955161600}
                        </span>
                      </div>
                      <div>
                        <span style={styles.statLabel}>T3: </span>
                        <span style={styles.statValue}>
                          {Number(config.troop.damage.t3DamageMultiplier) / 1844674407370955161600}
                        </span>
                      </div>
                      <div>
                        <span style={styles.statLabel}>Biome Bonus: </span>
                        <span style={styles.statValue}>{config.troop.damage.damageBiomeBonusNum / 100}%</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
