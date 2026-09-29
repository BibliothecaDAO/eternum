/** @public */
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
