import { ETERNUM_CONFIG } from "@/utils/config";
import { findResourceById } from "@/utils/resources";
import { RealmLevels } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { colors, formatAmount } from "./styles";

type Props = {
  level: RealmLevels;
  description: string;
};

export default function RealmUpgradeCosts({ level, description }: Props) {
  const config = ETERNUM_CONFIG();
  const realmUpgradeCosts = config.realmUpgradeCosts[level];

  const styles = {
    container: {
      padding: "1.5rem",
      marginBottom: "1.5rem",
      borderRadius: "0.5rem",
      border: `1px solid ${colors.border}`,
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },
    title: {
      fontSize: "1.125rem",
      fontWeight: "bold",
      marginBottom: "1rem",
    },
    resourcesGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: "1rem",
    },
    resourceItem: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      borderRadius: "0.375rem",
    },
    resourceInfo: {
      display: "flex",
      flexDirection: "column" as const,
    },
    resourceName: {
      fontWeight: "500",
    },
    resourceAmount: {
      fontWeight: "500",
    },
  };

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>{description}</h4>
      {realmUpgradeCosts.length > 0 ? (
        <div style={styles.resourcesGrid}>
          {realmUpgradeCosts.map((cost) => {
            const resource = findResourceById(cost.resource);
            return (
              <div key={cost.resource} style={styles.resourceItem}>
                <ResourceIcon size="lg" id={cost.resource} name={resource?.trait || ""} />
                <div style={styles.resourceInfo}>
                  <span style={styles.resourceName}>{resource?.trait}</span>
                  <span style={styles.resourceAmount}>{formatAmount(cost.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: colors.text.light }}>Your starting realm.</p>
      )}
    </div>
  );
}
