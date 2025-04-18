import { ETERNUM_CONFIG } from "@/utils/config";
import { BuildingType, resources } from "@bibliothecadao/types";
import { useState } from "react";
import ResourceIcon from "./ResourceIcon";

type Props = {
  buildingType: BuildingType;
};

// Helper function to format numbers with commas
const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat().format(Math.round(amount));
};

export default function BuildingCosts({ buildingType }: Props) {
  const [activeMode, setActiveMode] = useState<"simple" | "complex">("simple");
  console.log({ activeMode });

  const config = ETERNUM_CONFIG();

  // Get costs directly from the config files
  const complexCosts = config.buildings.complexBuildingCosts[buildingType] || [];
  const simpleCosts = config.buildings.simpleBuildingCost[buildingType] || [];

  // Check if this is a resource building (Wood, Stone, etc)
  const isResourceBuilding =
    (buildingType >= BuildingType.ResourceStone && buildingType <= BuildingType.ResourceDragonhide) ||
    buildingType === BuildingType.ResourceWheat ||
    buildingType === BuildingType.ResourceFish;

  // Shared styles
  const containerStyle = {
    margin: "1rem 0",
    padding: "1rem",
    backgroundColor: "rgba(30, 25, 20, 0.8)",
    borderRadius: "0.5rem",
    border: "1px solid #6d4923",
  };

  const titleStyle = {
    fontWeight: "bold",
    marginBottom: "0.75rem",
    fontSize: "1.125rem",
    color: "#f6c297",
  };

  const costItemStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 0.75rem",
    backgroundColor: "rgba(40, 30, 25, 0.9)",
    borderRadius: "0.375rem",
    border: "1px solid #5a3a1a",
  };

  const costGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "0.5rem",
  };

  const costSingleColumnStyle = {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "0.5rem",
  };

  const buttonBaseStyle = {
    padding: "0.5rem 1rem",
    borderRadius: "0.375rem",
    border: "1px solid",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
    transition: "all 0.2s ease",
    cursor: "pointer",
  };

  const activeButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: "#8b5a2b",
    borderColor: "#c69c6d",
    color: "white",
  };

  const inactiveButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: "#2a2018",
    borderColor: "#3a2a20",
    color: "#d0d0d0",
  };

  const noteStyle = {
    marginTop: "0.75rem",
    fontSize: "0.875rem",
    color: "#a0a0a0",
  };

  // Resource buildings have the same cost in both modes
  if (isResourceBuilding) {
    // Get costs directly from config
    const costs = config.buildings.complexBuildingCosts[buildingType] || [];

    return (
      <div style={containerStyle}>
        <div style={titleStyle}>Building Costs</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {costs.map((cost) => (
            <div key={cost.resource} style={costItemStyle}>
              <ResourceIcon
                id={cost.resource}
                name={resources.find((r) => r.id === cost.resource)?.trait || ""}
                size="xs"
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: "500", fontSize: "0.875rem" }}>
                  {resources.find((r) => r.id === cost.resource)?.trait || ""}
                </span>
                <span style={{ fontWeight: "600" }}>{formatAmount(cost.amount)}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={noteStyle}>Note: Resource buildings have the same cost in both Simple and Complex modes.</div>
      </div>
    );
  }

  // For T2 and T3 military buildings (complex mode only)
  const isComplexOnly =
    buildingType === BuildingType.ResourceKnightT2 ||
    buildingType === BuildingType.ResourceCrossbowmanT2 ||
    buildingType === BuildingType.ResourcePaladinT2 ||
    buildingType === BuildingType.ResourceKnightT3 ||
    buildingType === BuildingType.ResourceCrossbowmanT3 ||
    buildingType === BuildingType.ResourcePaladinT3;

  if (simpleCosts.length === 0 && complexCosts.length === 0) return null;

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>Building Costs</div>

      {isComplexOnly ? (
        <div>
          <div style={{ marginBottom: "0.5rem", color: "#f0b060", fontWeight: "500" }}>Complex Mode Only</div>
          <div style={costGridStyle}>
            {complexCosts.map((cost) => (
              <div key={cost.resource} style={costItemStyle}>
                <ResourceIcon
                  id={cost.resource}
                  name={resources.find((r) => r.id === cost.resource)?.trait || ""}
                  size="xs"
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: "500", fontSize: "0.875rem" }}>
                    {resources.find((r) => r.id === cost.resource)?.trait || ""}
                  </span>
                  <span style={{ fontWeight: "600" }}>{formatAmount(cost.amount)}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={noteStyle}>Note: T2 and T3 military buildings can only be constructed in Complex mode.</div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              style={activeMode === "simple" ? activeButtonStyle : inactiveButtonStyle}
              onClick={() => setActiveMode("simple")}
            >
              Simple (Labor)
            </button>
            <button
              style={activeMode === "complex" ? activeButtonStyle : inactiveButtonStyle}
              onClick={() => setActiveMode("complex")}
            >
              Complex (Raw Resources)
            </button>
          </div>

          {activeMode === "simple" && (
            <div style={costSingleColumnStyle}>
              {simpleCosts.map((cost) => (
                <div key={cost.resource} style={costItemStyle}>
                  <ResourceIcon
                    id={cost.resource}
                    name={resources.find((r) => r.id === cost.resource)?.trait || ""}
                    size="xs"
                  />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: "500", fontSize: "0.875rem" }}>
                      {resources.find((r) => r.id === cost.resource)?.trait || ""}
                    </span>
                    <span style={{ fontWeight: "600" }}>{formatAmount(cost.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeMode === "complex" && (
            <div style={costGridStyle}>
              {complexCosts.map((cost) => (
                <div key={cost.resource} style={costItemStyle}>
                  <ResourceIcon
                    id={cost.resource}
                    name={resources.find((r) => r.id === cost.resource)?.trait || ""}
                    size="xs"
                  />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: "500", fontSize: "0.875rem" }}>
                      {resources.find((r) => r.id === cost.resource)?.trait || ""}
                    </span>
                    <span style={{ fontWeight: "600" }}>{formatAmount(cost.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
