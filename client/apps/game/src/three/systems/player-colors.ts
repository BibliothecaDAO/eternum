/**
 * Player Color Identity System
 *
 * A robust, scalable color-identity system for distinguishing players in battles.
 *
 * ## Design Goals:
 * - High distinguishability: Colors clearly distinct at a glance for 4-16+ players
 * - Accessibility: Considers color-blindness (varies lightness/saturation, not just hue)
 * - Performance: Centralized color management, no per-unit material creation
 * - Multi-channel identity: Consistent colors across units, minimap, UI elements
 *
 * ## Palette Strategy:
 * - Uses HSL color space with carefully chosen hue spacing
 * - Avoids environment colors (grass greens, stone grays, sky blues)
 * - Maintains consistent lightness/saturation for visibility
 * - Provides fallback patterns for 9+ players
 *
 * ## Color Assignments:
 * - Player 0 (Self): Bright Green (#4ADE80) - high contrast, positive association
 * - Allies: Blue variants (#60A5FA) - peaceful, cooperative
 * - Enemies: Distributed across remaining hues with maximum separation
 */

import { Color } from "three";

/**
 * Complete color profile for a player identity
 */
export interface PlayerColorProfile {
  /** Unique player identifier (address hash or index) */
  playerId: string;

  /** Primary color for unit accents (banners, cloaks, trims) */
  primary: Color;

  /** Secondary color for highlights and outlines */
  secondary: Color;

  /** Color for minimap representation */
  minimap: Color;

  /** Color for selection rings when this player's units are selected */
  selection: Color;

  /** Text color for labels and UI */
  textColor: string;

  /** Background color for labels (with alpha) */
  backgroundColor: string;

  /** Border color for labels (with alpha) */
  borderColor: string;

  /** Lightness variant (0 = dark, 1 = normal, 2 = light) for additional distinction */
  lightnessVariant: number;

  /** Pattern index for 9+ player differentiation (0 = solid, 1+ = patterns) */
  patternIndex: number;
}

/**
 * Predefined color palette with carefully chosen hues
 * These are spaced to maximize perceptual distance while avoiding environment colors
 */
const COLOR_PALETTE = {
  // Self - Bright green (not grass green, more lime/mint)
  SELF: {
    primary: "#4ADE80", // Bright mint green
    secondary: "#22C55E", // Slightly darker green
    minimap: "#22C55E",
    selection: "#86EFAC",
    textColor: "#d9f99d",
    backgroundColor: "rgba(30, 95, 55, 0.3)",
    borderColor: "rgba(22, 163, 74, 0.5)",
  },

  // Allies - Blue variants
  ALLY: {
    primary: "#60A5FA", // Sky blue
    secondary: "#3B82F6", // Darker blue
    minimap: "#3B82F6",
    selection: "#93C5FD",
    textColor: "#bae6fd",
    backgroundColor: "rgba(40, 70, 150, 0.3)",
    borderColor: "rgba(37, 99, 235, 0.5)",
  },

  // AI Agents - Gold/Amber (special identifier)
  AGENT: {
    primary: "#FBBF24", // Amber
    secondary: "#F59E0B", // Darker amber
    minimap: "#F59E0B",
    selection: "#FCD34D",
    textColor: "#fbbf24",
    backgroundColor: "rgba(70, 70, 70, 0.8)",
    borderColor: "rgba(220, 220, 220, 0.5)",
  },

  // Neutral entities
  NEUTRAL: {
    primary: "#9CA3AF", // Gray
    secondary: "#6B7280", // Darker gray
    minimap: "#6B7280",
    selection: "#D1D5DB",
    textColor: "#e5e7eb",
    backgroundColor: "rgba(70, 70, 70, 0.3)",
    borderColor: "rgba(156, 163, 175, 0.5)",
  },
};

/**
 * Enemy color palette - Carefully chosen hues for maximum distinction
 * Avoids: grass green (90-150), sky blue (190-220), stone gray
 * Uses: Reds, oranges, purples, magentas, teals, yellows
 *
 * Ordered by perceptual distance for optimal 4/8/16 player support
 */
const ENEMY_HUES = [
  // Tier 1: Maximum distinction (4 players including self)
  0, // Red (#FF0000) - Classic enemy color
  270, // Purple (#8B00FF) - High contrast with red
  30, // Orange (#FF8000) - Warm, distinct from red

  // Tier 2: Good distinction (8 players)
  180, // Cyan (#00FFFF) - Cool complement to warm colors
  330, // Magenta (#FF00FF) - Distinct from purple and red
  45, // Gold/Yellow (#FFB300) - Warm, distinct from orange
  200, // Teal (#00CED1) - Cooler cyan variant
  300, // Violet (#9400D3) - Between purple and magenta

  // Tier 3: Acceptable distinction (16 players)
  15, // Red-orange (#FF4000)
  285, // Blue-violet (#7B00FF)
  60, // Yellow-orange (#FFCC00)
  165, // Cyan-green (#00FF80) - Careful: close to grass
  315, // Pink (#FF00CC)
  225, // Blue-cyan (#0080FF)
  345, // Rose (#FF0055)
  255, // Indigo (#5500FF)
];

/**
 * Lightness variants for additional distinction when hues are similar
 */
const LIGHTNESS_VARIANTS = [
  { l: 50, s: 80 }, // Normal
  { l: 65, s: 70 }, // Light variant
  { l: 35, s: 90 }, // Dark variant
];

/**
 * Convert HSL to hex color string
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a unique color for an enemy player based on their index
 */
function generateEnemyColor(
  playerIndex: number,
): Pick<PlayerColorProfile, "primary" | "secondary" | "minimap" | "selection" | "lightnessVariant" | "patternIndex"> {
  // Calculate which hue and variant to use
  const hueIndex = playerIndex % ENEMY_HUES.length;
  const variantIndex = Math.floor(playerIndex / ENEMY_HUES.length) % LIGHTNESS_VARIANTS.length;
  const patternIndex = Math.floor(playerIndex / (ENEMY_HUES.length * LIGHTNESS_VARIANTS.length));

  const hue = ENEMY_HUES[hueIndex];
  const variant = LIGHTNESS_VARIANTS[variantIndex];

  // Generate primary color
  const primaryHex = hslToHex(hue, variant.s, variant.l);

  // Generate secondary (darker) color
  const secondaryHex = hslToHex(hue, variant.s, Math.max(20, variant.l - 15));

  // Generate selection (lighter) color
  const selectionHex = hslToHex(hue, Math.max(40, variant.s - 20), Math.min(80, variant.l + 20));

  return {
    primary: new Color(primaryHex),
    secondary: new Color(secondaryHex),
    minimap: new Color(primaryHex),
    selection: new Color(selectionHex),
    lightnessVariant: variantIndex,
    patternIndex,
  };
}

/**
 * Generate text and background colors for labels based on primary color
 */
function generateLabelColors(primaryHex: string): { textColor: string; backgroundColor: string; borderColor: string } {
  const color = new Color(primaryHex);

  // Make text color lighter version of primary
  const textColor = new Color(primaryHex);
  textColor.offsetHSL(0, -0.1, 0.3);

  // Make background with low opacity
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  return {
    textColor: `#${textColor.getHexString()}`,
    backgroundColor: `rgba(${Math.round(r * 0.5)}, ${Math.round(g * 0.5)}, ${Math.round(b * 0.5)}, 0.3)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.5)`,
  };
}

/**
 * Player Color Manager
 *
 * Centralized manager for all player color assignments.
 * Caches color profiles to avoid recalculation and ensure consistency.
 */
class PlayerColorManager {
  private profileCache: Map<string, PlayerColorProfile> = new Map();
  private addressToIndex: Map<string, number> = new Map();
  private nextEnemyIndex = 0;

  /**
   * Get or create a color profile for the current player (self)
   */
  getSelfProfile(): PlayerColorProfile {
    const cacheKey = "__SELF__";
    if (this.profileCache.has(cacheKey)) {
      return this.profileCache.get(cacheKey)!;
    }

    const profile: PlayerColorProfile = {
      playerId: cacheKey,
      primary: new Color(COLOR_PALETTE.SELF.primary),
      secondary: new Color(COLOR_PALETTE.SELF.secondary),
      minimap: new Color(COLOR_PALETTE.SELF.minimap),
      selection: new Color(COLOR_PALETTE.SELF.selection),
      textColor: COLOR_PALETTE.SELF.textColor,
      backgroundColor: COLOR_PALETTE.SELF.backgroundColor,
      borderColor: COLOR_PALETTE.SELF.borderColor,
      lightnessVariant: 1,
      patternIndex: 0,
    };

    this.profileCache.set(cacheKey, profile);
    return profile;
  }

  /**
   * Get or create a color profile for an ally
   */
  getAllyProfile(): PlayerColorProfile {
    const cacheKey = "__ALLY__";
    if (this.profileCache.has(cacheKey)) {
      return this.profileCache.get(cacheKey)!;
    }

    const profile: PlayerColorProfile = {
      playerId: cacheKey,
      primary: new Color(COLOR_PALETTE.ALLY.primary),
      secondary: new Color(COLOR_PALETTE.ALLY.secondary),
      minimap: new Color(COLOR_PALETTE.ALLY.minimap),
      selection: new Color(COLOR_PALETTE.ALLY.selection),
      textColor: COLOR_PALETTE.ALLY.textColor,
      backgroundColor: COLOR_PALETTE.ALLY.backgroundColor,
      borderColor: COLOR_PALETTE.ALLY.borderColor,
      lightnessVariant: 1,
      patternIndex: 0,
    };

    this.profileCache.set(cacheKey, profile);
    return profile;
  }

  /**
   * Get or create a color profile for an AI agent
   */
  getAgentProfile(): PlayerColorProfile {
    const cacheKey = "__AGENT__";
    if (this.profileCache.has(cacheKey)) {
      return this.profileCache.get(cacheKey)!;
    }

    const profile: PlayerColorProfile = {
      playerId: cacheKey,
      primary: new Color(COLOR_PALETTE.AGENT.primary),
      secondary: new Color(COLOR_PALETTE.AGENT.secondary),
      minimap: new Color(COLOR_PALETTE.AGENT.minimap),
      selection: new Color(COLOR_PALETTE.AGENT.selection),
      textColor: COLOR_PALETTE.AGENT.textColor,
      backgroundColor: COLOR_PALETTE.AGENT.backgroundColor,
      borderColor: COLOR_PALETTE.AGENT.borderColor,
      lightnessVariant: 1,
      patternIndex: 0,
    };

    this.profileCache.set(cacheKey, profile);
    return profile;
  }

  /**
   * Get or create a color profile for a neutral entity
   */
  getNeutralProfile(): PlayerColorProfile {
    const cacheKey = "__NEUTRAL__";
    if (this.profileCache.has(cacheKey)) {
      return this.profileCache.get(cacheKey)!;
    }

    const profile: PlayerColorProfile = {
      playerId: cacheKey,
      primary: new Color(COLOR_PALETTE.NEUTRAL.primary),
      secondary: new Color(COLOR_PALETTE.NEUTRAL.secondary),
      minimap: new Color(COLOR_PALETTE.NEUTRAL.minimap),
      selection: new Color(COLOR_PALETTE.NEUTRAL.selection),
      textColor: COLOR_PALETTE.NEUTRAL.textColor,
      backgroundColor: COLOR_PALETTE.NEUTRAL.backgroundColor,
      borderColor: COLOR_PALETTE.NEUTRAL.borderColor,
      lightnessVariant: 1,
      patternIndex: 0,
    };

    this.profileCache.set(cacheKey, profile);
    return profile;
  }

  /**
   * Get or create a color profile for an enemy player by address
   *
   * @param playerAddress - The player's wallet address as a string
   * @returns A unique color profile for this enemy
   */
  getEnemyProfile(playerAddress: string): PlayerColorProfile {
    // Check cache first
    if (this.profileCache.has(playerAddress)) {
      return this.profileCache.get(playerAddress)!;
    }

    // Get or assign an index for this address
    let index = this.addressToIndex.get(playerAddress);
    if (index === undefined) {
      index = this.nextEnemyIndex++;
      this.addressToIndex.set(playerAddress, index);
    }

    // Generate colors for this enemy
    const colors = generateEnemyColor(index);
    const labelColors = generateLabelColors(`#${colors.primary.getHexString()}`);

    const profile: PlayerColorProfile = {
      playerId: playerAddress,
      ...colors,
      ...labelColors,
    };

    this.profileCache.set(playerAddress, profile);
    return profile;
  }

  /**
   * Get a color profile based on ownership context
   *
   * @param isMine - Is this the current player's unit?
   * @param isAlly - Is this an ally's unit?
   * @param isDaydreamsAgent - Is this an AI agent?
   * @param ownerAddress - The owner's wallet address (for enemy differentiation)
   */
  getProfileForUnit(
    isMine: boolean,
    isAlly: boolean,
    isDaydreamsAgent: boolean,
    ownerAddress?: bigint | string,
  ): PlayerColorProfile {
    if (isDaydreamsAgent) {
      return this.getAgentProfile();
    }
    if (isMine) {
      return this.getSelfProfile();
    }
    if (isAlly) {
      return this.getAllyProfile();
    }

    // Enemy - use address for unique color
    const addressStr = ownerAddress?.toString() ?? "__UNKNOWN_ENEMY__";
    return this.getEnemyProfile(addressStr);
  }

  /**
   * Clear all cached profiles (useful when player count changes significantly)
   */
  clearCache(): void {
    this.profileCache.clear();
    this.addressToIndex.clear();
    this.nextEnemyIndex = 0;
  }

  /**
   * Get current statistics for debugging
   */
  getStats(): { cachedProfiles: number; uniqueEnemies: number } {
    return {
      cachedProfiles: this.profileCache.size,
      uniqueEnemies: this.addressToIndex.size,
    };
  }

  /**
   * Get all currently assigned enemy colors (for debugging/UI)
   */
  getAllEnemyProfiles(): PlayerColorProfile[] {
    const profiles: PlayerColorProfile[] = [];
    this.addressToIndex.forEach((_, address) => {
      const profile = this.profileCache.get(address);
      if (profile) {
        profiles.push(profile);
      }
    });
    return profiles;
  }
}

// Export singleton instance
export const playerColorManager = new PlayerColorManager();

// Export preset colors for backward compatibility
export const PLAYER_COLOR_PRESETS = COLOR_PALETTE;

// Export utility functions
export { generateEnemyColor, hslToHex };

/**
 * Debug utilities for visualizing and testing the player color system
 */
export const playerColorDebug = {
  /**
   * Generate a visual preview of the color palette for N players
   * Returns an HTML string that can be injected into the DOM for testing
   */
  generatePalettePreview(playerCount: number): string {
    const profiles: PlayerColorProfile[] = [];

    // Add self
    profiles.push(playerColorManager.getSelfProfile());

    // Add ally
    profiles.push(playerColorManager.getAllyProfile());

    // Add agent
    profiles.push(playerColorManager.getAgentProfile());

    // Add enemies
    for (let i = 0; i < playerCount - 3; i++) {
      profiles.push(playerColorManager.getEnemyProfile(`test-enemy-${i}`));
    }

    let html = `
      <div style="font-family: system-ui; padding: 20px; background: #1a1a2e; color: white;">
        <h2 style="margin-bottom: 16px;">Player Color Palette (${playerCount} players)</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
    `;

    profiles.forEach((profile, index) => {
      const label =
        index === 0
          ? "Self"
          : index === 1
            ? "Ally"
            : index === 2
              ? "AI Agent"
              : `Enemy ${index - 2}`;
      html += `
        <div style="background: ${profile.backgroundColor}; border: 2px solid ${profile.borderColor}; border-radius: 8px; padding: 12px;">
          <div style="font-weight: bold; color: ${profile.textColor}; margin-bottom: 8px;">${label}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div style="width: 32px; height: 32px; border-radius: 4px; background: #${profile.primary.getHexString()};"></div>
            <div style="width: 24px; height: 24px; border-radius: 4px; background: #${profile.secondary.getHexString()};"></div>
            <div style="width: 20px; height: 20px; border-radius: 50%; background: #${profile.minimap.getHexString()};"></div>
            <div style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid #${profile.selection.getHexString()}; background: transparent;"></div>
          </div>
          <div style="font-size: 10px; color: #888; margin-top: 8px;">
            Primary: #${profile.primary.getHexString()}<br>
            Variant: ${profile.lightnessVariant} | Pattern: ${profile.patternIndex}
          </div>
        </div>
      `;
    });

    html += `
        </div>
        <div style="margin-top: 20px; font-size: 12px; color: #666;">
          <strong>Legend:</strong> Large square = Primary, Medium square = Secondary, Circle = Minimap, Ring = Selection
        </div>
      </div>
    `;

    return html;
  },

  /**
   * Show the palette preview in a popup window
   */
  showPalettePreview(playerCount: number = 16): void {
    const html = this.generatePalettePreview(playerCount);
    const win = window.open("", "Player Color Preview", "width=800,height=600,scrollbars=yes");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  },

  /**
   * Log all currently assigned colors to the console
   */
  logAssignedColors(): void {
    const stats = playerColorManager.getStats();
    console.group("Player Color Manager Stats");
    console.log(`Cached profiles: ${stats.cachedProfiles}`);
    console.log(`Unique enemies: ${stats.uniqueEnemies}`);
    console.groupEnd();

    const enemies = playerColorManager.getAllEnemyProfiles();
    if (enemies.length > 0) {
      console.group("Enemy Color Assignments");
      enemies.forEach((profile) => {
        console.log(
          `%c ${profile.playerId.slice(0, 16)}... `,
          `background: #${profile.primary.getHexString()}; color: white; padding: 2px 8px; border-radius: 4px;`,
        );
      });
      console.groupEnd();
    }
  },

  /**
   * Test color generation for a specific number of enemies
   */
  testColorGeneration(enemyCount: number): void {
    console.group(`Testing color generation for ${enemyCount} enemies`);

    const tempManager = new PlayerColorManager();
    for (let i = 0; i < enemyCount; i++) {
      const profile = tempManager.getEnemyProfile(`test-${i}`);
      console.log(
        `Enemy ${i}: %c ████ `,
        `color: #${profile.primary.getHexString()};`,
        `Hue index: ${i % ENEMY_HUES.length}, Variant: ${profile.lightnessVariant}`,
      );
    }

    console.groupEnd();
  },

  /**
   * Reset all color assignments (useful for testing)
   */
  reset(): void {
    playerColorManager.clearCache();
    console.log("Player color assignments cleared");
  },
};

// Expose debug utilities globally in development
if (typeof window !== "undefined") {
  (window as unknown as { playerColorDebug: typeof playerColorDebug }).playerColorDebug = playerColorDebug;
}
