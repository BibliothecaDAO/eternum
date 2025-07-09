import ResourceIcon from "@/components/ResourceIcon";
import { colors, formatAmount } from "@/components/styles";
import { ETERNUM_CONFIG } from "@/utils/config";
import { resources } from "@/utils/constants";

export const BlitzBuildingCard = ({
  title,
  image,
  buildingType,
  description = [],
  simpleCosts = [],
  standardCosts = [],
  standardOnly = false,
}) => {
  const population = ETERNUM_CONFIG().buildings.buildingPopulation[buildingType] || 0;
  
  // Determine if this building produces a resource (exclude Worker's Hut and Storehouse)
  const isResourceBuilding = buildingType !== 1 && buildingType !== 2; // 1 = Worker's Hut, 2 = Storehouse
  
  // Get the resource ID for resource buildings
  const getResourceId = () => {
    if (!isResourceBuilding) return undefined;
    // For resource buildings, the resource ID is the building type - 2
    return buildingType - 2;
  };

  const resourceId = getResourceId();
  const resourceName = resourceId ? resources.find((r) => r.id === resourceId)?.trait || "" : "";

  const styles = {
    card: {
      padding: "0.75rem",
      marginBottom: "1rem",
      borderRadius: "0.375rem",
      border: `1px solid #8b5a2b`,
      backgroundColor: colors.background.dark,
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "0.5rem",
      borderBottom: `1px solid ${colors.borderDark}`,
      paddingBottom: "0.25rem",
    },
    titleContainer: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      fontWeight: "bold",
      color: "#f6c297",
    },
    content: {
      display: "flex",
      gap: "0.75rem",
    },
    image: {
      width: "80px",
      height: "80px",
      objectFit: "contain",
      padding: "0.25rem",
      backgroundColor: colors.background.light,
      border: `1px solid ${colors.borderDark}`,
      borderRadius: "0.25rem",
    },
    info: {
      flex: 1,
      fontSize: "0.875rem",
    },
    stats: {
      display: "flex",
      gap: "0.5rem",
      marginBottom: "0.5rem",
    },
    stat: {
      padding: "0.25rem 0.5rem",
      backgroundColor: colors.background.dark,
      borderRadius: "0.25rem",
      fontSize: "0.75rem",
    },
    desc: {
      fontSize: "0.8rem",
      color: colors.secondary,
      marginBottom: "0.5rem",
    },
    costsContainer: {
      marginTop: "0.5rem",
      borderTop: `1px solid ${colors.borderDark}`,
      paddingTop: "0.5rem",
    },
    costsTitle: {
      fontWeight: "bold",
      fontSize: "0.875rem",
      color: "#f6c297",
      marginBottom: "0.375rem",
    },
    modeHeader: {
      fontSize: "0.75rem",
      color: colors.primary,
      backgroundColor: "rgba(60, 40, 20, 0.3)",
      padding: "0.125rem 0.375rem",
      borderRadius: "0.25rem",
      marginBottom: "0.25rem",
      display: "inline-block",
    },
    costsRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: "0.25rem",
      marginBottom: "0.5rem",
    },
    costItem: {
      display: "flex",
      alignItems: "center",
      gap: "0.25rem",
      padding: "0.25rem 0.375rem",
      backgroundColor: "rgba(40, 30, 25, 0.6)",
      borderRadius: "0.25rem",
      fontSize: "0.75rem",
    },
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.titleContainer}>
          {resourceId && <ResourceIcon id={resourceId} name={resourceName} size="lg" />}
          {title}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#a89986" }}>ID: {buildingType}</div>
      </div>

      <div style={styles.content}>
        <img src={image} alt={title} style={styles.image} />

        <div style={styles.info}>
          <div style={styles.stats}>{population > 0 && <div style={styles.stat}>Pop Req: {population}</div>}</div>

          <ul style={{ listStyleType: "disc", marginLeft: "1rem", marginBottom: "0.5rem" }}>
            {description.map((desc, index) => (
              <li key={index} style={styles.desc}>
                {desc}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={styles.costsContainer}>
        <div style={styles.costsTitle}>Building Costs</div>

        {standardOnly ? (
          <div>
            <div style={styles.modeHeader}>Standard Only</div>
            <div style={styles.costsRow}>
              {standardCosts.map((cost, index) => (
                <div key={index} style={styles.costItem}>
                  {cost.resource === "essence" ? (
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        backgroundColor: "#f8bbd9",
                        borderRadius: "2px",
                        border: "1px solid #ec4899",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <ResourceIcon id={cost.resource} name="" size="md" />
                  )}
                  {formatAmount(cost.amount)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div>
              <div style={styles.modeHeader}>Simple</div>
              <div style={styles.costsRow}>
                {simpleCosts.map((cost, index) => (
                  <div key={index} style={styles.costItem}>
                    <ResourceIcon id={cost.resource} name="" size="md" />
                    {formatAmount(cost.amount)}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={styles.modeHeader}>Standard</div>
              <div style={styles.costsRow}>
                {standardCosts.map((cost, index) => (
                  <div key={index} style={styles.costItem}>
                    {cost.resource === "essence" ? (
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          backgroundColor: "#f8bbd9",
                          borderRadius: "2px",
                          border: "1px solid #ec4899",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <ResourceIcon id={cost.resource} name="" size="md" />
                    )}
                    {formatAmount(cost.amount)}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
