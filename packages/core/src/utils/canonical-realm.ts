/** Immutable canonical traits; gameplay state still comes from the selected world. */
export async function getCanonicalRealmMetadata(realmId: number) {
  if (!Number.isInteger(realmId) || realmId < 1 || realmId > 8000) {
    throw new Error("Choose a realm number from 1 to 8000.");
  }
  const { default: realms } = await import("../data/full-realms.json");
  const realm = realms[String(realmId) as keyof typeof realms];
  return {
    name: realm.name,
    resources: realm.attributes.filter((trait) => trait.trait_type === "Resource").map((trait) => String(trait.value)),
  };
}
