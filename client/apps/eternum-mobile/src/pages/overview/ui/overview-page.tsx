import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function OverviewPage() {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Game Overview</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Resource overview coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Army Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Army status overview coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Territory</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Territory overview coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Achievements overview coming soon</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
