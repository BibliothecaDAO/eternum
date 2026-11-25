const rowIndex = (answer, model, matches) =>
  (answer?.answered ?? []).findIndex((fact) => fact.model === model && fact.value !== null && matches(fact.value));

export function balanceChange(answer, resource) {
  const at = rowIndex(answer, "ResourceBalance", (value) => Number(value.resource_type) === resource);
  if (at === -1) return undefined;
  return BigInt(answer.answered[at].value.balance) - BigInt(answer.before?.[at]?.balance ?? 0);
}

export function troopChange(answer, explorerId) {
  const at = rowIndex(
    answer,
    "ExplorerTroops",
    (value) => explorerId === undefined || Number(value.explorer_id) === explorerId,
  );
  if (at === -1) return undefined;
  return BigInt(answer.answered[at].value.troops.count) - BigInt(answer.before?.[at]?.troops?.count ?? 0);
}
