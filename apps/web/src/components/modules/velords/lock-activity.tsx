import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface WeeklyLockActivityRow {
  week: string;
  updates: number;
  uniqueWallets: number;
}

export function VelordsLockActivity({ data, isLoading }: { data: WeeklyLockActivityRow[]; isLoading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lock Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading lock activity...</div>
        ) : data.length === 0 ? (
          <div className="text-muted-foreground text-sm">No lock activity is available for this period.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead className="text-right">Lock Updates</TableHead>
                <TableHead className="text-right">Unique Wallets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.week}>
                  <TableCell>{row.week}</TableCell>
                  <TableCell className="text-right">{row.updates}</TableCell>
                  <TableCell className="text-right">{row.uniqueWallets}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
