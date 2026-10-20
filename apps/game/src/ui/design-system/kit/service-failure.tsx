import { useEffect } from "react";

import { AppNotice } from "./app-elements";
import { failureLine, type Service } from "./failure-lines";

/**
 * A read that failed: the service's one line with Try again on it. The service's own words (a status, a code, a host)
 * go to the console for the operator, never onto the page.
 */
export const ServiceFailure = ({ service, error, retry }: { service: Service; error: unknown; retry?: () => void }) => {
  useEffect(() => {
    console.error("shell_read_failed", { service, error });
  }, [error, service]);
  return <AppNotice tone="bad" line={failureLine(service)} retry={retry} />;
};
