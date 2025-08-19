import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export const Trading = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Trading</CardTitle>
          <CardDescription>Master the economy of Eternum</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">The Lords Market</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Trade resources through the Lords Market, the central hub for all economic activity. Exchange materials
              with other players using Lords tokens as the primary currency for transactions.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transport & Donkeys</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Donkeys are essential for transporting goods between locations. Each journey consumes the donkey, so plan
              your logistics carefully. More valuable trades may require more donkeys for transport.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Banks & Alternative Trading</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Banks are special world structures that provide alternative trading venues. They can also facilitate
              bridging materials out of the game as ERC20 tokens for real-world value.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Economic Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Control resource production, corner markets, and establish trade monopolies. Economic dominance can be as
              powerful as military conquest in achieving victory.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
