import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export const Realm = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Realms</CardTitle>
          <CardDescription>The foundation of your empire</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Realm Basics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Realms are your primary settlements, producing 1-7 different resources. They can be upgraded from
              Settlement to City, Kingdom, and finally Empire, unlocking more buildable hexes and defensive
              capabilities.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Villages</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Villages offer a simpler entry point, producing at 50% efficiency compared to Realms. They're tied to a
              parent Realm and cannot be claimed, only raided.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upgrades & Defense</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Higher-tier Realms provide more buildable hexes, population capacity, and defensive slots. Invest in
              upgrades to maximize production and protection.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Claiming & Protection</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Realms can be claimed if their defenses fall, making protection crucial. Villages cannot be claimed but
              can still be raided for resources.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
