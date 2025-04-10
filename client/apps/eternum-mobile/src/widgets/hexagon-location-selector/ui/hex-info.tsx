import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { HexLocation } from "../model/types";

interface HexInfoProps {
  selectedLocation: HexLocation | null;
}

export function HexInfo({ selectedLocation }: HexInfoProps) {
  return (
    <Card className="w-full mb-4 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Selected Hexagon</CardTitle>
      </CardHeader>
      <CardContent>
        {selectedLocation ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm font-semibold">Column:</div>
            <div className="text-sm">{selectedLocation.col}</div>
            <div className="text-sm font-semibold">Row:</div>
            <div className="text-sm">{selectedLocation.row}</div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No hexagon selected</div>
        )}
      </CardContent>
    </Card>
  );
}
