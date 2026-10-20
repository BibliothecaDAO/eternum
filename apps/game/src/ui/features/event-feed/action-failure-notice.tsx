import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import type { ActionFailure } from "./notify";

/**
 * An action's failure told where it was asked, the one way every inline form tells it: a refusal ("Starts in 2m 33s")
 * as news, a status line; a failure as an error, an alert.
 */
export const ActionFailureNotice = ({ failure }: { failure: ActionFailure }) => (
  <HudNotice tone={failure.refused ? undefined : "bad"} line={failure.reason} />
);
