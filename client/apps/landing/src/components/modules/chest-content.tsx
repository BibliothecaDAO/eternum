import { Card, CardContent } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { ModelViewer } from "./model-viewer";

interface ChestAsset {
  id: string;
  name: string;
  type: "armor" | "skin" | "aura" | "title";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  modelPath: string;
}

const mockAssets: ChestAsset[] = [
  { id: "1", name: "Knight T1", type: "armor", rarity: "rare", modelPath: "/models/units/knight1.glb" },
  { id: "2", name: "Paladin T1", type: "armor", rarity: "rare", modelPath: "/models/units/paladin1.glb" },
  { id: "3", name: "Crossbowman T1", type: "armor", rarity: "rare", modelPath: "/models/units/archer1.glb" },
  { id: "4", name: "Knight T2", type: "armor", rarity: "legendary", modelPath: "/models/units/knight2.glb" },
  { id: "5", name: "Paladin T2", type: "armor", rarity: "legendary", modelPath: "/models/units/paladin2.glb" },
  { id: "6", name: "Crossbowman T2", type: "armor", rarity: "legendary", modelPath: "/models/units/archer2.glb" },
  { id: "7", name: "Knight T3", type: "armor", rarity: "epic", modelPath: "/models/units/knight3.glb" },
  { id: "8", name: "Paladin T3", type: "armor", rarity: "epic", modelPath: "/models/units/paladin3.glb" },
  { id: "9", name: "Crossbowman T3", type: "armor", rarity: "epic", modelPath: "/models/units/archer3.glb" },
];

const getTypeStyle = (type: ChestAsset["type"]) => {
  switch (type) {
    case "armor":
      return { backgroundColor: "#2563eb", color: "white" };
    case "skin":
      return { backgroundColor: "#9333ea", color: "white" };
    case "aura":
      return { backgroundColor: "#ca8a04", color: "black" };
    case "title":
      return { backgroundColor: "#16a34a", color: "white" };
    default:
      return { backgroundColor: "#4b5563", color: "white" };
  }
};

const getRarityStyle = (rarity: ChestAsset["rarity"]) => {
  switch (rarity) {
    case "common":
      return { backgroundColor: "#22c55e", color: "white", borderColor: "#4ade80" }; // Green
    case "uncommon":
      return { backgroundColor: "#3b82f6", color: "white", borderColor: "#60a5fa" }; // Blue
    case "rare":
      return { backgroundColor: "#a855f7", color: "white", borderColor: "#c084fc" }; // Purple
    case "epic":
      return { backgroundColor: "#f97316", color: "white", borderColor: "#fb923c" }; // Orange
    case "legendary":
      return { backgroundColor: "#ef4444", color: "white", borderColor: "#f87171" }; // Red
    default:
      return { backgroundColor: "#6b7280", color: "white", borderColor: "#9ca3af" };
  }
};

const getRarityGlow = (rarity: ChestAsset["rarity"]) => {
  switch (rarity) {
    case "common":
      return {
        borderColor: "#22c55e", // Green
        backgroundColor: "rgba(34, 197, 94, 0.15)",
        boxShadow: "0 0 15px rgba(34, 197, 94, 0.4)",
        borderWidth: "2px",
        borderStyle: "solid",
      };
    case "uncommon":
      return {
        borderColor: "#3b82f6", // Blue
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        boxShadow: "0 0 18px rgba(59, 130, 246, 0.5)",
        borderWidth: "2px",
        borderStyle: "solid",
      };
    case "rare":
      return {
        borderColor: "#a855f7", // Purple
        backgroundColor: "rgba(168, 85, 247, 0.2)",
        boxShadow: "0 0 22px rgba(168, 85, 247, 0.6)",
        borderWidth: "2px",
        borderStyle: "solid",
      };
    case "epic":
      return {
        borderColor: "#f97316", // Orange
        backgroundColor: "rgba(249, 115, 22, 0.2)",
        boxShadow: "0 0 28px rgba(249, 115, 22, 0.6)",
        borderWidth: "2px",
        borderStyle: "solid",
      };
    case "legendary":
      return {
        borderColor: "#ef4444", // Red
        backgroundColor: "rgba(239, 68, 68, 0.2)",
        boxShadow: "0 0 35px rgba(239, 68, 68, 0.7)",
        borderWidth: "2px",
        borderStyle: "solid",
      };
    default:
      return {
        borderColor: "#6b7280",
        backgroundColor: "rgba(107, 114, 128, 0.15)",
        borderWidth: "2px",
        borderStyle: "solid",
      };
  }
};

// Function to shuffle array and pick 3 random items
const getRandomAssets = (assets: ChestAsset[], count: number = 3): ChestAsset[] => {
  const shuffled = [...assets].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export const ChestContent = ({ showContent }: { showContent: boolean }) => {
  // Generate 3 random assets once when component mounts
  const randomAssets = useMemo(() => getRandomAssets(mockAssets, 3), []);
  const [selectedAsset, setSelectedAsset] = useState<ChestAsset>(randomAssets[0]);

  const renderTitle = () => {
    return (
      <h1
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          fontSize: "2.25rem",
          fontWeight: 700,
          color: "#FFD700",
          transition: "opacity 5000ms",
          opacity: showContent ? 1 : 0,
          textAlign: "center",
        }}
      >
        Loot Chest Contents
        <span className="text-sm text-white">(3 items)</span>
      </h1>
    );
  };

  return (
    <div className="relative w-full h-screen">
      {/* Full-screen 3D background */}
      <div
        className="absolute inset-0"
        style={{
          transition: "opacity 5000ms",
          opacity: showContent ? 1 : 0,
        }}
      >
        <ModelViewer modelPath={selectedAsset.modelPath} className="w-full h-full" />
      </div>

      {/* Overlay UI - pointer-events-none to allow 3D interaction */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        {/* Title at top */}
        <div className="flex justify-center pt-8">{renderTitle()}</div>

        {/* Asset list on the right side */}
        <div className="flex-1 flex justify-end items-center pr-8">
          <div
            className="w-80 space-y-4 pointer-events-auto"
            style={{
              transition: "opacity 1000ms",
              opacity: showContent ? 1 : 0,
            }}
          >
            <h2 className="text-xl font-bold text-white mb-4 text-center">Loot Contents</h2>

            {randomAssets.map((asset) => {
              const isSelected = selectedAsset.id === asset.id;
              const cardStyle = isSelected
                ? getRarityGlow(asset.rarity)
                : {
                    borderColor: "#4b5563",
                    borderWidth: "2px",
                    borderStyle: "solid",
                  };

              return (
                <Card
                  key={asset.id}
                  className="cursor-pointer transition-all duration-200 backdrop-blur-sm"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    ...cardStyle,
                    ...(isSelected
                      ? {}
                      : {
                          transition: "all 200ms",
                        }),
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#6b7280";
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#4b5563";
                      e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
                    }
                  }}
                  onClick={() => setSelectedAsset(asset)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-white">{asset.name}</h3>
                          <span
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              ...getRarityStyle(asset.rarity),
                              fontSize: "0.75rem",
                            }}
                          >
                            {asset.rarity.toUpperCase()}
                          </span>
                        </div>
                        <span className="px-2 py-1 rounded text-xs" style={getTypeStyle(asset.type)}>
                          {asset.type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
