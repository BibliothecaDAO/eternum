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

const getTypeClass = (type: ChestAsset["type"]) => {
  switch (type) {
    case "armor":
      return "bg-blue-600 text-white";
    case "skin":
      return "bg-purple-600 text-white";
    case "aura":
      return "bg-yellow-600 text-black";
    case "title":
      return "bg-green-600 text-white";
    default:
      return "bg-gray-600 text-white";
  }
};

const getRarityClass = (rarity: ChestAsset["rarity"]) => {
  switch (rarity) {
    case "common":
      return "bg-green-500 text-white";
    case "uncommon":
      return "bg-blue-500 text-white";
    case "rare":
      return "bg-purple-500 text-white";
    case "epic":
      return "bg-orange-500 text-white";
    case "legendary":
      return "bg-red-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
};

const getRarityGlowClass = (rarity: ChestAsset["rarity"]) => {
  switch (rarity) {
    case "common":
      return "border-2 border-green-500 bg-green-500/15 shadow-[0_0_15px_rgba(34,197,94,0.4)]";
    case "uncommon":
      return "border-2 border-blue-500 bg-blue-500/20 shadow-[0_0_18px_rgba(59,130,246,0.5)]";
    case "rare":
      return "border-2 border-purple-500 bg-purple-500/20 shadow-[0_0_22px_rgba(168,85,247,0.6)]";
    case "epic":
      return "border-2 border-orange-500 bg-orange-500/20 shadow-[0_0_28px_rgba(249,115,22,0.6)]";
    case "legendary":
      return "border-2 border-red-500 bg-red-500/20 shadow-[0_0_35px_rgba(239,68,68,0.7)]";
    default:
      return "border-2 border-gray-500 bg-gray-500/15";
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
        className="flex items-center justify-center gap-2 text-4xl font-bold text-chest-gold text-center"
        style={{
          transition: "opacity 5000ms",
          opacity: showContent ? 1 : 0,
        }}
      >
        Loot Chest Content
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
            className="w-96 space-y-4 pointer-events-auto"
            style={{
              transition: "opacity 1000ms",
              opacity: showContent ? 1 : 0,
            }}
          >
            {/* Container for the asset list */}
            <div className="backdrop-blur-md rounded-2xl p-6 bg-gradient-to-br from-black/80 to-gray-900/60 border-2 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]">
              {/* Container header */}
              <div className="mb-4 text-center">
                <div className="text-sm text-gray-300 font-heading font-semibold tracking-wider uppercase">
                  ⚔️ Item Selection ⚔️
                </div>
                <div className="mt-1 w-16 mx-auto h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent" />
              </div>

              {/* Asset grid with enhanced spacing */}
              <div className="space-y-3">
                {randomAssets.map((asset) => {
                  const isSelected = selectedAsset.id === asset.id;
                  const baseCardClass = "cursor-pointer transition-all duration-200 backdrop-blur-sm";
                  const cardClass = isSelected
                    ? `${baseCardClass} ${getRarityGlowClass(asset.rarity)}`
                    : `${baseCardClass} border-2 border-gray-600 bg-black/40 hover:border-gray-500 hover:bg-white/10`;

                  return (
                    <Card key={asset.id} className={cardClass} onClick={() => setSelectedAsset(asset)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-white">{asset.name}</h3>
                              <span className={`text-xs px-2 py-1 rounded ${getRarityClass(asset.rarity)}`}>
                                {asset.rarity.toUpperCase()}
                              </span>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${getTypeClass(asset.type)}`}>
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
      </div>
    </div>
  );
};
