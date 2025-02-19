import { Claim } from "@/widgets/claim/ui/claim";

const DUMMY_CLAIMS = [
  {
    entityId: 1,
    entityType: "donkey" as const,
    resources: [
      { id: 3, amount: 100 }, // Wood
      { id: 1, amount: 50 }, // Stone
    ],
  },
  {
    entityId: 2,
    entityType: "army" as const,
    resources: [
      { id: 7, amount: 200 }, // Gold
      { id: 4, amount: 75 }, // Copper
      { id: 8, amount: 150 }, // Silver
      { id: 11, amount: 25 }, // Cold Iron
    ],
  },
  {
    entityId: 3,
    entityType: "donkey" as const,
    resources: [
      { id: 3, amount: 300 }, // Wood
      { id: 1, amount: 200 }, // Stone
      { id: 2, amount: 150 }, // Coal
      { id: 4, amount: 100 }, // Copper
      { id: 5, amount: 50 }, // Ironwood
      { id: 6, amount: 25 }, // Obsidian
    ],
  },
  {
    entityId: 4,
    entityType: "army" as const,
    resources: [
      { id: 7, amount: 500 }, // Gold
      { id: 8, amount: 400 }, // Silver
      { id: 9, amount: 50 }, // Mithral
      { id: 10, amount: 75 }, // Alchemical Silver
      { id: 11, amount: 200 }, // Cold Iron
      { id: 12, amount: 150 }, // Deep Crystal
      { id: 13, amount: 100 }, // Ruby
      { id: 14, amount: 50 }, // Diamonds
    ],
  },
];

export function ClaimTab() {
  return (
    <div className="space-y-4">
      {DUMMY_CLAIMS.map((claim) => (
        <Claim
          key={`${claim.entityType}-${claim.entityId}`}
          entityId={claim.entityId}
          entityType={claim.entityType}
          resources={claim.resources}
        />
      ))}
    </div>
  );
}
