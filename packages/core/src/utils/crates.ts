// Fantasy name generation for treasure chests - inspired by Loot project
const adjectives = [
  "Ancient",
  "Forgotten",
  "Cursed",
  "Blessed",
  "Mystical",
  "Sacred",
  "Lost",
  "Hidden",
  "Golden",
  "Silver",
  "Ethereal",
  "Shadowed",
  "Glimmering",
  "Arcane",
  "Enchanted",
  "Legendary",
  "Fabled",
  "Runic",
  "Crystalline",
  "Obsidian",
  "Celestial",
  "Infernal",
  "Divine",
  "Ornate",
  "Demonic",
  "Draconic",
  "Holy",
  "Grim",
  "Brilliant",
  "Hypnotic",
];

// Inspired by Loot's name prefixes
const namePrefixes = [
  "Agony",
  "Apocalypse",
  "Armageddon",
  "Beast",
  "Behemoth",
  "Blight",
  "Blood",
  "Bramble",
  "Brimstone",
  "Brood",
  "Carrion",
  "Cataclysm",
  "Chimeric",
  "Corpse",
  "Corruption",
  "Damnation",
  "Death",
  "Demon",
  "Dire",
  "Dragon",
  "Dread",
  "Doom",
  "Dusk",
  "Eagle",
  "Empyrean",
  "Fate",
  "Foe",
  "Gale",
  "Ghoul",
  "Gloom",
  "Glyph",
  "Golem",
  "Grim",
  "Hate",
  "Havoc",
  "Honour",
  "Horror",
  "Hypnotic",
  "Kraken",
  "Loath",
  "Maelstrom",
  "Mind",
  "Miracle",
  "Morbid",
  "Oblivion",
  "Onslaught",
  "Pain",
  "Pandemonium",
  "Phoenix",
  "Plague",
  "Rage",
  "Rapture",
  "Rune",
  "Skull",
  "Sol",
  "Soul",
  "Sorrow",
  "Spirit",
  "Storm",
  "Tempest",
  "Torment",
  "Vengeance",
  "Victory",
  "Viper",
  "Vortex",
  "Woe",
  "Wrath",
  "Light",
  "Shimmering",
];

// Inspired by Loot's name suffixes
const nameSuffixes = [
  "Bane",
  "Root",
  "Bite",
  "Song",
  "Roar",
  "Grasp",
  "Instrument",
  "Glow",
  "Bender",
  "Shadow",
  "Whisper",
  "Shout",
  "Growl",
  "Tear",
  "Peak",
  "Form",
  "Sun",
  "Moon",
  "Star",
  "Crown",
  "Throne",
  "Heart",
  "Soul",
  "Mind",
  "Will",
  "Might",
  "Keeper",
  "Guardian",
  "Warden",
  "Protector",
  "Slayer",
  "Forge",
];

// Inspired by Loot's suffixes
const suffixes = [
  "of Power",
  "of Giants",
  "of Titans",
  "of Skill",
  "of Perfection",
  "of Brilliance",
  "of Enlightenment",
  "of Protection",
  "of Anger",
  "of Rage",
  "of Fury",
  "of Vitriol",
  "of the Fox",
  "of Detection",
  "of Reflection",
  "of the Twins",
];

export function getCrateName(entityId: number): string {
  // Use entityId as seed for deterministic random generation - inspired by Loot's pluck function
  const seed = entityId;

  // Simple hash function for deterministic randomness
  const hash = (n: number) => {
    let h = n;
    h = ((h << 16) ^ h) >>> 0;
    h = (h * 0x21f0aaad) >>> 0;
    h = ((h << 15) ^ h) >>> 0;
    h = (h * 0x735a2d97) >>> 0;
    h = ((h << 15) ^ h) >>> 0;
    return h;
  };

  const rand = hash(seed);

  // Base chest name
  const adjIndex = rand % adjectives.length;
  let chestName = `${adjectives[adjIndex]} Crate`;

  // Determine "greatness" like in Loot - affects rarity and naming complexity
  const greatness = rand % 21;

  // Add suffix (like "of Power") for common rare items (greatness > 14)
  if (greatness > 14 && greatness < 19) {
    const suffixIndex = hash(seed * 2) % suffixes.length;
    chestName += ` ${suffixes[suffixIndex]}`;
  }

  // Add name prefix and suffix for very rare items (greatness >= 19)
  if (greatness >= 19) {
    const prefixIndex = hash(seed * 3) % namePrefixes.length;
    const nameIndex = hash(seed * 4) % nameSuffixes.length;
    const selectedNameSuffix = nameSuffixes[nameIndex];

    // Determine if the nameSuffix should be possessive or standalone
    const possessiveWords = [
      "Bane",
      "Root",
      "Bite",
      "Song",
      "Roar",
      "Grasp",
      "Instrument",
      "Glow",
      "Shadow",
      "Whisper",
      "Shout",
      "Growl",
      "Tear",
      "Peak",
      "Form",
    ];
    const standaloneWords = [
      "Sun",
      "Moon",
      "Star",
      "Crown",
      "Throne",
      "Heart",
      "Soul",
      "Mind",
      "Will",
      "Might",
      "Keeper",
      "Guardian",
      "Warden",
      "Protector",
      "Slayer",
      "Forge",
    ];

    let finalName: string;

    if (possessiveWords.includes(selectedNameSuffix)) {
      // For words like "Bane", "Shadow" - use pattern: "Doom Crate's Bane"
      finalName = `${namePrefixes[prefixIndex]} Crate's ${selectedNameSuffix}`;
    } else if (standaloneWords.includes(selectedNameSuffix)) {
      // For words like "Keeper", "Guardian" - use pattern: "Doom Crate Guardian"
      finalName = `${namePrefixes[prefixIndex]} Crate ${selectedNameSuffix}`;
    } else {
      // Default pattern for other words
      finalName = `${namePrefixes[prefixIndex]} Crate of ${selectedNameSuffix}`;
    }

    chestName = finalName;

    // Add additional suffix for the most legendary items (greatness == 20)
    if (greatness === 20) {
      const epicSuffixIndex = hash(seed * 5) % suffixes.length;
      chestName += ` ${suffixes[epicSuffixIndex]}`;
    }
  }

  return chestName;
}
