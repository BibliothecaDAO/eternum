import { StarknetProvider } from "@/hooks/starknet-provider";
import { useVelords } from "@/hooks/use-velords";

function HeroApyValueContent() {
  const { currentAPY } = useVelords();
  return <>{currentAPY ? `${currentAPY.toFixed(2)}%` : "—"}</>;
}

export function HeroApyValue() {
  return (
    <StarknetProvider>
      <HeroApyValueContent />
    </StarknetProvider>
  );
}
