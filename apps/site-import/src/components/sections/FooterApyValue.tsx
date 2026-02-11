import { StarknetProvider } from "@/hooks/starknet-provider";
import { useVelords } from "@/hooks/use-velords";

function FooterApyValueContent() {
  const { currentAPY } = useVelords();
  return <>{currentAPY ? `${currentAPY.toFixed(2)}%` : "12.5%"}</>;
}

export function FooterApyValue() {
  return (
    <StarknetProvider>
      <FooterApyValueContent />
    </StarknetProvider>
  );
}
