import { useEffect } from "react";

import { Button } from "@/ui/design-system/kit/button";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { TRY_AGAIN } from "@/ui/design-system/kit/words";
import { failureLine, type Service } from "./failure-lines";

/**
 * A read that failed: the service's one line with Try again on it. The service's own words (a status, a code, a host)
 * go to the console for the operator, never onto the page.
 */
export const ServiceFailure = ({ service, error, retry }: { service: Service; error: unknown; retry?: () => void }) => {
  useEffect(() => {
    console.error("shell_read_failed", { service, error });
  }, [error, service]);
  return (
    <ReasonPlate
      reason={{ kind: "failed", line: failureLine(service) }}
      step={retry && <Button role="outline" word={TRY_AGAIN} onClick={retry} />}
    />
  );
};
