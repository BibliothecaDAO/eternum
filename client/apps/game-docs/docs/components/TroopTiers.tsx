import { TroopTier, TroopType } from "@bibliothecadao/types";
import { colors, section, table } from "./styles";

export const getTroopName = (troopType: TroopType, troopTier: TroopTier): string => {
  switch (troopTier) {
    case TroopTier.T1:
      switch (troopType) {
        case TroopType.Knight:
          return "Footman";
        case TroopType.Crossbowman:
          return "Archer";
        case TroopType.Paladin:
          return "Horseman";
      }
    case TroopTier.T2:
      switch (troopType) {
        case TroopType.Knight:
          return "Knight";
        case TroopType.Crossbowman:
          return "Crossbowman";
        case TroopType.Paladin:
          return "Paladin";
      }
    case TroopTier.T3:
      switch (troopType) {
        case TroopType.Knight:
          return "Royal Guardian";
        case TroopType.Crossbowman:
          return "Beast Hunter";
        case TroopType.Paladin:
          return "Dragon Rider";
      }
  }
};

export const troopTypeTierImages = (tier: TroopTier, type: TroopType) => {
  switch (tier) {
    case TroopTier.T1:
      switch (type) {
        case TroopType.Crossbowman:
          return "/images/armies/crossbowmanT1.png";
        case TroopType.Paladin:
          return "/images/armies/paladinT1.png";
        case TroopType.Knight:
          return "/images/armies/knightT1.png";
      }
    case TroopTier.T2:
      switch (type) {
        case TroopType.Crossbowman:
          return "/images/armies/crossbowmanT2.png";
        case TroopType.Paladin:
          return "/images/armies/paladinT2.png";
        case TroopType.Knight:
          return "/images/armies/knightT2.png";
      }
    case TroopTier.T3:
      switch (type) {
        case TroopType.Crossbowman:
          return "/images/armies/crossbowmanT3.png";
        case TroopType.Paladin:
          return "/images/armies/paladinT3.png";
        case TroopType.Knight:
          return "/images/armies/knightT3.png";
      }
  }
};

const getTroopTypeName = (type: TroopType): string => {
  switch (type) {
    case TroopType.Crossbowman:
      return "Crossbowman";
    case TroopType.Paladin:
      return "Paladin";
    case TroopType.Knight:
      return "Knight";
  }
};

const getTierName = (tier: TroopTier): string => {
  switch (tier) {
    case TroopTier.T1:
      return "Tier 1";
    case TroopTier.T2:
      return "Tier 2";
    case TroopTier.T3:
      return "Tier 3";
  }
};

export const TroopTiers = () => {
  const troopTypes = [TroopType.Crossbowman, TroopType.Paladin, TroopType.Knight];
  const troopTiers = [TroopTier.T1, TroopTier.T2, TroopTier.T3];

  // Additional styles specific to this component
  const styles = {
    container: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "2rem",
    },
    troopTypeSection: {
      backgroundColor: colors.background.medium,
      borderRadius: "8px",
      padding: "1.5rem",
      border: `1px solid ${colors.border}`,
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.15)",
    },
    troopTypeHeader: {
      color: colors.primary,
      fontSize: "1.2rem",
      fontWeight: "bold",
      marginBottom: "1.25rem",
      paddingBottom: "0.75rem",
      borderBottom: `1px solid ${colors.borderDark}`,
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    troopsGridStyle: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
      gap: "1.25rem",
    },
    troopCardStyle: {
      borderRadius: "6px",
      overflow: "hidden",
      backgroundColor: colors.background.light,
      border: `1px solid ${colors.border}`,
    },
    troopHeaderStyle: {
      padding: "0.75rem",
      backgroundColor: colors.background.header,
      color: colors.primary,
      fontWeight: "bold",
      borderBottom: `1px solid ${colors.borderDark}`,
      margin: 0,
      fontSize: "1rem",
      textAlign: "center" as const,
    },
    troopImageContainerStyle: {
      width: "100%",
      height: "180px",
      overflow: "hidden",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(20, 15, 10, 0.5)",
    },
    troopImageStyle: {
      width: "100%",
      height: "100%",
      objectFit: "contain" as const,
      transform: "scale(1.8)",
      transition: "transform 0.3s ease",
    },
    tierBadgeStyle: {
      position: "absolute" as const,
      top: "8px",
      right: "8px",
      padding: "4px 8px",
      backgroundColor: "rgba(240, 176, 96, 0.2)",
      borderRadius: "4px",
      color: colors.primary,
      fontSize: "0.8rem",
      fontWeight: "bold",
    },
    troopCardContentStyle: {
      position: "relative" as const,
    },
    troopNameStyle: {
      fontSize: "0.8rem",
      fontStyle: "italic",
      textAlign: "center" as const,
    },
  };

  return (
    <div style={section.wrapper}>
      <div style={section.subtitle}>Troop Types & Tiers</div>
      <div style={styles.container}>
        {troopTypes.map((type) => (
          <div key={type} style={styles.troopTypeSection}>
            <div style={styles.troopTypeHeader}>
              <span>{getTroopTypeName(type)}</span>
            </div>
            <div style={styles.troopsGridStyle}>
              {troopTiers.map((tier) => (
                <div key={`${type}-${tier}`} style={styles.troopCardStyle}>
                  <h3 style={styles.troopHeaderStyle}>{getTierName(tier)}</h3>
                  <div style={styles.troopNameStyle}>{getTroopName(type, tier)}</div>
                  <div style={styles.troopCardContentStyle}>
                    <div style={styles.troopImageContainerStyle}>
                      <img
                        src={troopTypeTierImages(tier, type)}
                        alt={`${getTroopTypeName(type)} ${getTierName(tier)}`}
                        style={styles.troopImageStyle}
                        onError={(e) => {
                          // Fallback if image loading fails
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          target.parentElement!.innerHTML = `
                            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: rgba(20, 15, 10, 0.5); color: #dfc296; flex-direction: column; padding: 8px;">
                              <div>Image not available</div>
                              <div><code>${troopTypeTierImages(tier, type)}</code></div>
                            </div>
                          `;
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TroopTierDamageStats = () => {
  return (
    <div style={section.wrapper}>
      <div style={section.subtitle}>Troop Tier Stats</div>

      <div style={section.commonCard}>
        <div style={section.commonHeader}>
          <span>⚔️</span> Damage Comparison by Tier
        </div>

        <table style={table.compareTable}>
          <thead style={table.tableHead}>
            <tr>
              <th style={{ ...table.tableHeaderCell, ...table.tableFirstColumn }}>Tier</th>
              <th style={table.tableHeaderCell}>Cum. Damage Inc. over T1</th>
              <th style={table.tableHeaderCell}>Diff. Between Tiers</th>
            </tr>
          </thead>
          <tbody>
            <tr style={table.tableRow}>
              <td style={{ ...table.tableCell, ...table.tableFirstColumn }}>
                <div style={table.tableTierCell}>
                  <span style={table.tierBadge}>T1</span>
                  Base
                </div>
              </td>
              <td style={table.tableCell}> / </td>
              <td style={table.tableCell}> / </td>
            </tr>
            <tr style={table.tableRow}>
              <td style={{ ...table.tableCell, ...table.tableFirstColumn }}>
                <div style={table.tableTierCell}>
                  <span style={table.tierBadge}>T2</span>
                  2.5 × T1
                </div>
              </td>
              <td style={{ ...table.tableCell, fontWeight: "bold" }}>250%</td>
              <td style={{ ...table.tableCell, fontWeight: "bold" }}>250%</td>
            </tr>
            <tr style={table.tableRow}>
              <td style={{ ...table.tableCell, ...table.tableFirstColumn }}>
                <div style={table.tableTierCell}>
                  <span style={table.tierBadge}>T3</span>
                  2.8 × T2 (7 × T1)
                </div>
              </td>
              <td style={{ ...table.tableCell, fontWeight: "bold" }}>700%</td>
              <td style={{ ...table.tableCell, fontWeight: "bold" }}>450%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
