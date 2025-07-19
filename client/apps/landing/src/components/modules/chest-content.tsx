import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { ModelViewer } from "./model-viewer";

interface ChestAsset {
  id: string;
  name: string;
  type: "armor" | "skin" | "aura" | "title";
  modelPath: string;
}

const mockAssets: ChestAsset[] = [
  { id: "1", name: "Knight's Armor", type: "armor", modelPath: "/models/units/knight1.glb" },
  { id: "2", name: "Royal Skin", type: "skin", modelPath: "/models/units/knight1.glb" },
  { id: "3", name: "Golden Aura", type: "aura", modelPath: "/models/units/knight1.glb" },
];

const getTypeColor = (type: ChestAsset["type"]) => {
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

export const ChestContent = ({ showContent }: { showContent: boolean }) => {
  const [selectedAsset, setSelectedAsset] = useState<ChestAsset>(mockAssets[0]);

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
        <div className="flex justify-center pt-8">
          {renderTitle()}
        </div>

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

            {mockAssets.map((asset) => (
              <Card
                key={asset.id}
                className={`cursor-pointer transition-all duration-200 backdrop-blur-sm bg-black/40 border-2 ${
                  selectedAsset.id === asset.id
                    ? "border-yellow-500 bg-yellow-500/20"
                    : "border-gray-600 hover:border-gray-400 hover:bg-white/10"
                }`}
                onClick={() => setSelectedAsset(asset)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{asset.name}</h3>
                      <Badge className={`mt-1 ${getTypeColor(asset.type)}`}>{asset.type.toUpperCase()}</Badge>
                    </div>
                    {selectedAsset.id === asset.id && (
                      <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
