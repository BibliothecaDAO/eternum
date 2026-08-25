import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getVelordsSourceLabel } from "@/lib/velords-sources";
import { formatNumber, shortenAddress } from "@/utils/utils";
import { formatUnits } from "viem";

interface SourceBreakdownItem {
  sender: string;
  totalWei: string;
  txCount: number;
  sharePercent: string;
}

export function VelordsSourceBreakdown({ data, isLoading }: { data: SourceBreakdownItem[]; isLoading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rewards Source Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading source breakdown...</div>
        ) : data.length === 0 ? (
          <div className="text-muted-foreground text-sm">No rewards source data is available for this period.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">LORDS</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="text-right">Txs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.sender}>
                  <TableCell>
                    <div className="font-medium">{getVelordsSourceLabel(item.sender)}</div>
                    <div className="text-muted-foreground text-xs">{shortenAddress(item.sender)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(formatUnits(BigInt(item.totalWei), 18)))}
                  </TableCell>
                  <TableCell className="text-right">{item.sharePercent}%</TableCell>
                  <TableCell className="text-right">{item.txCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
