import { StarknetProvider } from "@/hooks/starknet-provider";
import { useVelords } from "@/hooks/use-velords";

function FooterApyValueContent() {
  const { currentAPY } = useVelords();
  return <>{typeof currentAPY === "number" ? `${currentAPY.toFixed(2)}%` : "—"}</>;
}

export function FooterApyValue() {
  return (
    <StarknetProvider>
      <FooterApyValueContent />
    </StarknetProvider>
  );
}
