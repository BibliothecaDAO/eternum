import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ResourceAmount } from "@/shared/ui/resource-amount";

interface Resource {
  id: number;
  amount: number;
}

interface ClaimProps {
  resources: Resource[];
  entityId: number;
  entityType: "donkey" | "army";
}

export function Claim({ resources, entityId, entityType }: ClaimProps) {
  const handleClaim = () => {
    // TODO: Implement claim functionality
    console.log("Claiming resources for", entityType, entityId);
  };

  return (
    <Card className="p-4 space-y-4">
      <h3 className="text-lg">
        <span className="font-bokor">{entityType === "donkey" ? "Donkeys" : "Army"} arrived!</span>{" "}
        <span className="text-muted-foreground text-md">#{entityId}</span>
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {resources.map((resource) => (
          <ResourceAmount
            key={resource.id}
            resourceId={resource.id}
            amount={resource.amount}
            size="md"
            showName={true}
            direction="horizontal"
          />
        ))}
      </div>

      <Button className="w-full" variant="default" onClick={handleClaim}>
        Claim resources
      </Button>
    </Card>
  );
}
