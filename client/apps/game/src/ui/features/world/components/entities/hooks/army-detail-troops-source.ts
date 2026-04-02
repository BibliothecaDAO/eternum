export const resolveArmyDetailTroopsSource = <TTroops>(input: {
  liveExplorerTroops: TTroops | undefined;
  queryExplorerTroops: TTroops | undefined;
}): TTroops | undefined => {
  return input.liveExplorerTroops ?? input.queryExplorerTroops;
};
