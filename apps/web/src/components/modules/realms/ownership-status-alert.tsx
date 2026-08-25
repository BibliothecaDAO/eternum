import type { RealmOwnershipInventoryStatus } from "@realms-world/db";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoaderCircle, TriangleAlert } from "lucide-react";

interface OwnershipStatusAlertProps {
  status?: RealmOwnershipInventoryStatus;
  isError?: boolean;
  onRetry?: () => void;
  className?: string;
}

export function OwnershipStatusAlert({ status, isError = false, onRetry, className }: OwnershipStatusAlertProps) {
  if (isError) {
    return (
      <Alert variant="destructive" className={className}>
        <TriangleAlert className="h-5 w-5" />
        <AlertTitle>Realm inventory is unavailable</AlertTitle>
        <AlertDescription>
          Ownership data could not be loaded. Your on-chain Realms are safe.
          {onRetry && (
            <Button variant="link" className="h-auto px-1 py-0" onClick={onRetry}>
              Try again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "syncing") {
    return (
      <Alert variant="warning" className={className}>
        <LoaderCircle className="h-5 w-5 animate-spin" />
        <AlertTitle>Realm inventory is syncing</AlertTitle>
        <AlertDescription>
          Historical ownership is still being indexed. Your Realms will appear here when the initial sync reaches the
          current block.
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "unavailable") {
    return (
      <Alert variant="destructive" className={className}>
        <TriangleAlert className="h-5 w-5" />
        <AlertTitle>Realm inventory indexer is unavailable</AlertTitle>
        <AlertDescription>
          No ownership checkpoint is available. Your on-chain Realms are safe; try again after the indexer has been
          started.
          {onRetry && (
            <Button variant="link" className="h-auto px-1 py-0" onClick={onRetry}>
              Try again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "stale") {
    return (
      <Alert variant="warning" className={className}>
        <TriangleAlert className="h-5 w-5" />
        <AlertTitle>Realm inventory updates are delayed</AlertTitle>
        <AlertDescription>
          The latest indexed block is out of date, so ownership is hidden until indexing resumes.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
