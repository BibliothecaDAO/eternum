import { ROUTES } from "@/shared/consts/routes";
import { useWallet } from "@/shared/hooks/use-wallet";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { useNavigate } from "@tanstack/react-router";

export function LoginPage() {
  const navigate = useNavigate();
  const { connectWallet, isConnecting, isConnected, displayAddress } = useWallet();

  const handleConnect = async () => {
    try {
      await connectWallet();
      navigate({ to: ROUTES.REALM });
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-4">
      <img src="/images/eternum-logo-words.svg" alt="Eternum Logo" className="w-3/4 my-12" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Eternum</CardTitle>
          <CardDescription>
            {isConnected ? `Connected with wallet: ${displayAddress}` : "Connect your wallet to start playing"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
            {isConnecting ? "Connecting..." : isConnected ? "Connected" : "Connect Wallet"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
