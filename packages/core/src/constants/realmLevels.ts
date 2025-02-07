export enum RealmLevels {
  Settlement,
  City,
  Kingdom,
  Empire,
}

export enum RealmLevelNames {
  Settlement = "Settlement",
  City = "City",
  Kingdom = "Kingdom",
  Empire = "Empire",
}

export const getLevelName = (level: RealmLevels): string => {
  return RealmLevelNames[RealmLevels[level] as keyof typeof RealmLevelNames];
};

export const LEVEL_DESCRIPTIONS = {
  [RealmLevels.Settlement]: "A small settlement with a few buildings. You have 6 buildable hexes.",
  [RealmLevels.City]: "You will have 18 buildable hexes, and a glorious city with many districts.",
  [RealmLevels.Kingdom]: "You  will have 36 buildable hexes, and a kingdom with many cities and towns.",
  [RealmLevels.Empire]: "You will have 60 buildable hexes, and a vast empire with many kingdoms and cities.",
};
