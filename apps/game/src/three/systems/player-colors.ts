import { Color } from "three";

export interface PlayerColorProfile {
  playerId: string;
  primary: Color;
  secondary: Color;
  minimap: Color;
  selection: Color;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  lightnessVariant: number;
  patternIndex: number;
}

// Ownership has the same meaning on sails, unit accents, labels and the map.
const PALETTE = {
  self: {
    primary: "#4ADE80",
    secondary: "#22C55E",
    minimap: "#22C55E",
    selection: "#86EFAC",
    textColor: "#d9f99d",
    backgroundColor: "rgba(30, 95, 55, 0.3)",
    borderColor: "rgba(22, 163, 74, 0.5)",
  },
  ally: {
    primary: "#60A5FA",
    secondary: "#3B82F6",
    minimap: "#3B82F6",
    selection: "#93C5FD",
    textColor: "#bae6fd",
    backgroundColor: "rgba(40, 70, 150, 0.3)",
    borderColor: "rgba(37, 99, 235, 0.5)",
  },
  enemy: {
    primary: "#EF4444",
    secondary: "#DC2626",
    minimap: "#DC2626",
    selection: "#FCA5A5",
    textColor: "#fecaca",
    backgroundColor: "rgba(120, 30, 30, 0.3)",
    borderColor: "rgba(220, 38, 38, 0.5)",
  },
};

function createProfile(relation: keyof typeof PALETTE): PlayerColorProfile {
  const colors = PALETTE[relation];
  return {
    ...colors,
    playerId: relation,
    primary: new Color(colors.primary),
    secondary: new Color(colors.secondary),
    minimap: new Color(colors.minimap),
    selection: new Color(colors.selection),
    lightnessVariant: 1,
    patternIndex: 0,
  };
}

const profiles = { self: createProfile("self"), ally: createProfile("ally"), enemy: createProfile("enemy") };

export const playerColorManager = {
  getProfileForUnit(
    isMine: boolean,
    isAlly: boolean,
    _isDaydreamsAgent: boolean,
    _ownerAddress?: bigint | string,
  ): PlayerColorProfile {
    if (isMine) return profiles.self;
    if (isAlly) return profiles.ally;
    return profiles.enemy;
  },
};
