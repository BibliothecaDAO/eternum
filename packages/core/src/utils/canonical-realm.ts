import { orders } from "@bibliothecadao/types";

/** Immutable canonical traits; gameplay state still comes from the selected world. */
export async function getCanonicalRealmMetadata(realmId: number) {
  if (!Number.isInteger(realmId) || realmId < 1 || realmId > 8000) {
    throw new Error("Choose a realm number from 1 to 8000.");
  }
  const { default: realms } = await import("../data/full-realms.json");
  const realm = realms[String(realmId) as keyof typeof realms];
  const orderTrait = realm.attributes.find((trait) => trait.trait_type === "Order")?.value;
  const order = orders.find(({ fullOrderName }) => `The ${fullOrderName}` === orderTrait);
  if (!order) throw new Error(`Realm ${realmId} names no known Order`);
  return {
    name: realm.name,
    order: order.orderId,
    resources: realm.attributes.filter((trait) => trait.trait_type === "Resource").map((trait) => String(trait.value)),
  };
}
