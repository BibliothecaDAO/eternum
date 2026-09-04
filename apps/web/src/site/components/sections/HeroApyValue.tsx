import { useVelords } from "@/site/hooks/use-velords";

function HeroApyValueContent() {
  const { currentAPY } = useVelords();
  return <>{typeof currentAPY === "number" ? `${currentAPY.toFixed(2)}%*` : "—"}</>;
}

export function HeroApyValue() {
  return <HeroApyValueContent />;
}
