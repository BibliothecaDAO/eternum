import { Card } from "@/shared/ui/card";

export function WorldmapPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6 pt-8">
      <Card className="p-6 max-w-sm mx-auto">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <h1 className="text-2xl font-bokor text-foreground">World Map</h1>
          <p className="text-muted-foreground">Coming Soon</p>
          <p className="text-sm text-muted-foreground/70">
            Explore the vast world of Eternum and discover new realms, resources, and adventures.
          </p>
        </div>
      </Card>

      {/* Bottom spacing for footer */}
      <div className="h-20" />
    </div>
  );
}
