import { SeasonPassRow } from "@/components/modules/season-pass-row";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/passes")({
  component: Passes,
});

function Passes() {
  return (
    <div>
      <SeasonPassRow />
    </div>
  );
}
